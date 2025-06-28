import logging
import time
import numpy as np
from pathlib import Path
from typing import Dict, Optional
from threading import Lock, Thread
from pydub import AudioSegment
from audio_processing.models.audio import AppState, PlayState, Layer, LayerMode, Environment
from audio_processing.models.layer_info import LayerInfo
import uuid
from scipy import signal

logger = logging.getLogger(__name__)

# Define audio file directory
AUDIO_DIR = Path(__file__).parent.parent / 'data' / 'audio'


class AudioMixer:
    """Handles mixing and streaming of audio layers."""

    # Audio configuration
    SAMPLE_RATE = 48000  # Hz
    CHANNELS = 2
    CHUNK_MS = 40  # Size of processing chunks in milliseconds
    TARGET_BUFFER_MS = 200  # Target buffer size in Discord (in milliseconds)

    def __init__(self):
        """Initialize the audio mixer."""
        self.chunk_samples = int(self.SAMPLE_RATE * (self.CHUNK_MS / 1000))
        self.target_buffer_chunks = self.TARGET_BUFFER_MS // self.CHUNK_MS
        self.lock = Lock()
        self._bot_manager = None
        self.is_running = False
        self._process_thread: Optional[Thread] = None
        self._guild_id: Optional[int] = None
        self.app_state: Optional[AppState] = None
        self.cached_layers: Dict[str, LayerInfo] = {}
        # Track environment states
        self._env_states: Dict[str, PlayState] = {}
        # Initialize filter states
        self._high_pass_state = None
        self._low_pass_state = None

    def _apply_filters(self, chunk: np.ndarray) -> np.ndarray:
        """Apply high-pass and low-pass filters to the audio chunk.
        
        Args:
            chunk: Audio chunk as int32 numpy array
            
        Returns:
            Filtered audio chunk as int32 numpy array
        """
        if not self.app_state:
            return chunk

        # Get filter frequencies
        high_pass_freq = self.app_state.effects.filters.high_pass.frequency
        low_pass_freq = self.app_state.effects.filters.low_pass.frequency

        if high_pass_freq == 0.0 and low_pass_freq == 20000.0:
            return chunk

        # Convert to float32 for filter processing
        chunk_float = chunk.astype(np.float32) / 32768.0

        nyquist = self.SAMPLE_RATE / 2

        # Only apply filters if frequencies are in valid ranges
        if high_pass_freq > 0:
            # Design high-pass filter (4th order Butterworth)
            normalized_freq = high_pass_freq / nyquist
            b, a = signal.butter(4, normalized_freq, btype='high')

            # Initialize filter state if needed
            if self._high_pass_state is None:
                self._high_pass_state = [np.zeros(4) for _ in range(self.CHANNELS)]

            # Apply filter to each channel
            filtered = np.zeros_like(chunk_float)
            for channel in range(self.CHANNELS):
                filtered_signal, self._high_pass_state[channel] = signal.lfilter(
                    b, a, chunk_float[:, channel],
                    zi=self._high_pass_state[channel]
                )
                filtered[:, channel] = filtered_signal
            chunk_float = filtered

        if low_pass_freq < nyquist:
            # Design low-pass filter (4th order Butterworth)
            normalized_freq = low_pass_freq / nyquist
            b, a = signal.butter(4, normalized_freq, btype='low')

            # Initialize filter state if needed
            if self._low_pass_state is None:
                self._low_pass_state = [np.zeros(4) for _ in range(self.CHANNELS)]

            # Apply filter to each channel
            filtered = np.zeros_like(chunk_float)
            for channel in range(self.CHANNELS):
                filtered_signal, self._low_pass_state[channel] = signal.lfilter(
                    b, a, chunk_float[:, channel],
                    zi=self._low_pass_state[channel]
                )
                filtered[:, channel] = filtered_signal
            chunk_float = filtered

        # Convert back to int32
        return (chunk_float * 32768.0).astype(np.int32)

    def _apply_compressor(self, chunk: np.ndarray) -> np.ndarray:
        """Apply dynamic range compression to the audio chunk.
        
        Args:
            chunk: Audio chunk as float32 numpy array in range [-1.0, 1.0]
            
        Returns:
            Compressed audio chunk as float32 numpy array
        """
        if not self.app_state:
            return chunk

        # Get compressor ratio
        ratio = self.app_state.effects.compressor.ratio

        if ratio == 1.0:
            return chunk

        # Get compressor settings
        low_threshold = self.app_state.effects.compressor.lowThreshold
        high_threshold = self.app_state.effects.compressor.highThreshold

        # Initialize state if needed
        if not hasattr(self, '_compressor_state'):
            self._compressor_state = {
                'prev_gain': np.ones(self.CHANNELS),
                'smoothing': 0.9  # Smoothing factor for gain changes
            }

        # Calculate peak levels for each channel
        peak_levels = np.max(np.abs(chunk), axis=0)

        # Initialize output array
        compressed = chunk.copy()

        # Process each channel
        for ch in range(self.CHANNELS):
            if peak_levels[ch] == 0:
                continue

            # Convert peak to dB
            peak_db = 20 * np.log10(peak_levels[ch])

            # Calculate target gain
            if low_threshold < peak_db < high_threshold:
                # Between thresholds - no compression
                target_gain = 1.0
            else:
                if peak_db <= low_threshold:
                    # Below low threshold - reduce the distance to threshold
                    db_below = low_threshold - peak_db
                    # Only move 1/ratio of the way to the threshold
                    gain_db = db_below / ratio
                    target_gain = 10 ** (gain_db / 20)
                else:
                    # Above high threshold - reduce by ratio
                    db_above = peak_db - high_threshold
                    # Move signal down by ratio
                    gain_db = -db_above * (1 - 1 / ratio)
                    target_gain = 10 ** (gain_db / 20)

            # Smooth gain transition
            current_gain = (self._compressor_state['smoothing'] * self._compressor_state['prev_gain'][ch] +
                            (1 - self._compressor_state['smoothing']) * target_gain)

            # Apply gain
            compressed[:, ch] *= current_gain

            # Store gain for next chunk
            self._compressor_state['prev_gain'][ch] = current_gain

        return np.clip(compressed, -1.0, 1.0)

    def _apply_speech_dampening(self, chunk: np.ndarray) -> np.ndarray:
        """Apply speech range dampening when voice is detected.
        
        Args:
            chunk: Audio chunk as float32 numpy array in range [-1.0, 1.0]
            
        Returns:
            Processed audio chunk as float32 numpy array
        """
        if not self.app_state or not self._bot_manager:
            return chunk

        # Get dampening settings
        dampen = self.app_state.effects.filters.dampen_speech_range
        if dampen.amount == 0.0:
            return chunk

        # Check for voice activity using our guild_id
        if not self._bot_manager.has_voice_activity(self._guild_id):
            return chunk

        try:
            # Create three bandpass filters to cover different parts of the speech range
            nyquist = self.SAMPLE_RATE / 2

            # Low speech range (fundamental frequencies)
            low_speech = (100 / nyquist, 600 / nyquist)
            # Mid speech range (vowels)
            mid_speech = (600 / nyquist, 2000 / nyquist)
            # High speech range (consonants)
            high_speech = (2000 / nyquist, 4000 / nyquist)

            # Initialize filter states if needed
            if not hasattr(self, '_speech_filter_states'):
                self._speech_filter_states = {
                    'low': [np.zeros(4) for _ in range(self.CHANNELS)],
                    'mid': [np.zeros(4) for _ in range(self.CHANNELS)],
                    'high': [np.zeros(4) for _ in range(self.CHANNELS)]
                }

            # Create filters
            b_low, a_low = signal.butter(2, low_speech, btype='band')
            b_mid, a_mid = signal.butter(2, mid_speech, btype='band')
            b_high, a_high = signal.butter(2, high_speech, btype='band')

            # Apply filters to isolate different frequency ranges
            speech_range = np.zeros_like(chunk)

            for ch in range(self.CHANNELS):
                # Process each frequency range
                low_filtered, self._speech_filter_states['low'][ch] = signal.lfilter(
                    b_low, a_low, chunk[:, ch], zi=self._speech_filter_states['low'][ch]
                )
                mid_filtered, self._speech_filter_states['mid'][ch] = signal.lfilter(
                    b_mid, a_mid, chunk[:, ch], zi=self._speech_filter_states['mid'][ch]
                )
                high_filtered, self._speech_filter_states['high'][ch] = signal.lfilter(
                    b_high, a_high, chunk[:, ch], zi=self._speech_filter_states['high'][ch]
                )

                # Combine the filtered ranges with different weights
                speech_range[:, ch] = (low_filtered * 1.0 +
                                       mid_filtered * 1.5 +  # Emphasize mid range
                                       high_filtered * 0.5)  # De-emphasize high range

            # Check for NaN values
            if np.any(np.isnan(speech_range)):
                logger.warning("NaN values detected in speech range, resetting filter states")
                self._speech_filter_states = {
                    'low': [np.zeros(4) for _ in range(self.CHANNELS)],
                    'mid': [np.zeros(4) for _ in range(self.CHANNELS)],
                    'high': [np.zeros(4) for _ in range(self.CHANNELS)]
                }
                return chunk

            # Calculate attenuation in dB
            attenuation_db = -24.0 * dampen.amount
            attenuation_factor = 10 ** (attenuation_db / 20)

            # Apply attenuation and mix back
            result = chunk - (speech_range * (1.0 - attenuation_factor))

            # Ensure we're not getting any NaN values
            if np.any(np.isnan(result)):
                logger.warning("NaN values detected in result, using original audio")
                return chunk

            return result

        except Exception as e:
            logger.error(f"Error in speech dampening: {e}")
            return chunk

    def _process_audio(self):
        """Main audio processing loop."""
        try:
            logger.info("Starting main audio processing loop")

            # Initialize timing
            frame_time_ns = int(self.CHUNK_MS * 1_000_000)  # Convert to nanoseconds
            next_frame_time = time.time_ns()
            processing_overhead_ns = 0  # Track average processing overhead
            alpha = 0.1  # Smoothing factor for overhead estimation

            # Track audio stats
            last_stats_time = time.time()
            chunks_processed = 0
            chunks_sent = 0
            
            # Pre-allocate mix buffers
            main_mix = np.zeros((self.chunk_samples, self.CHANNELS), dtype=np.int32)
            env_mix = np.zeros((self.chunk_samples, self.CHANNELS), dtype=np.int32)

            while self.is_running:
                loop_start_ns = time.time_ns()

                # Log stats every 5 seconds
                current_time = time.time()
                if current_time - last_stats_time >= 5:
                    logger.info(
                        f"Audio stats: {chunks_processed} chunks processed, {chunks_sent} chunks sent in last 5s")
                    chunks_processed = 0
                    chunks_sent = 0
                    last_stats_time = current_time

                # Calculate sleep time accounting for processing overhead
                sleep_time_ns = next_frame_time - loop_start_ns - processing_overhead_ns
                if sleep_time_ns > 1_000_000:  # Only sleep if we have more than 1ms to wait
                    time.sleep(sleep_time_ns / 1_000_000_000)

                # If we're more than half a frame behind, skip to catch up
                current_time_ns = time.time_ns()
                frames_behind = (current_time_ns - next_frame_time) // frame_time_ns
                if frames_behind > 0:
                    # Only skip if we're significantly behind
                    if frames_behind > 1:
                        logger.debug(f"Skipping {frames_behind} frames to catch up")
                    next_frame_time = current_time_ns + frame_time_ns
                
                with self.lock:
                    if not self.app_state or not self._guild_id:
                        logger.error("Missing app_state or guild_id in processing loop")
                        next_frame_time += frame_time_ns
                        continue

                    # Check if voice client is still connected
                    if hasattr(self._bot_manager, 'is_voice_connected'):
                        if not self._bot_manager.is_voice_connected(self._guild_id):
                            logger.warning("Voice client disconnected, attempting to reconnect")
                            try:
                                self._bot_manager.ensure_voice_client(self._guild_id)
                                time.sleep(0.5)  # Wait for connection
                            except Exception as e:
                                logger.error(f"Failed to reconnect voice client: {e}")
                                next_frame_time += frame_time_ns
                                continue

                    # Check Discord's buffer status
                    if hasattr(self._bot_manager, 'audio_manager'):
                        buffer_size = self._bot_manager.audio_manager.get_buffer_size(self._guild_id)
                        if buffer_size and buffer_size >= self.target_buffer_chunks:
                            # Update timing and continue
                            next_frame_time += frame_time_ns
                            continue

                    # Update environment states and detect transitions
                    current_env_states = {env.id: env.play_state for env in self.app_state.environments}

                    # Check for transitions and reset layers if needed
                    for env in self.app_state.environments:
                        last_state = self._env_states.get(env.id)
                        if env.play_state == PlayState.PLAYING and last_state == PlayState.STOPPED:
                            logger.info(f"Environment {env.id} transitioned from STOPPED to PLAYING - resetting layers")

                            # Clear any existing cached layers for this environment
                            for layer in env.layers:
                                if not layer.sounds:
                                    continue
                                # Find and clear all cached layers for this environment
                                stale_cache_keys = [
                                    key for key in list(self.cached_layers.keys())
                                    if key.startswith(f"{layer.id}_")
                                ]
                                for key in stale_cache_keys:
                                    logger.info(f"Clearing stale layer cache: {key}")
                                    del self.cached_layers[key]

                                # Load and reset the layer
                                if layer.selected_sound_index >= len(layer.sounds):
                                    layer.selected_sound_index = 0
                                selected_sound = layer.sounds[layer.selected_sound_index]
                                layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                                if layer_info:
                                    logger.info(f"Reset layer {layer.id} with sound {selected_sound.file_id}")
                                    layer_info.reset_position()
                                    logger.info(f"Layer {layer.id} ready to play")

                    # Update stored states
                    self._env_states = current_env_states

                    # Get active environments (either playing or fading)
                    active_envs = [env for env in self.app_state.environments if
                                 env.play_state == PlayState.PLAYING or env.is_fading]

                    # Check for active soundboard sounds
                    soundboard_layers = [layer for key, layer in self.cached_layers.items()
                                      if key.startswith("soundboard_") and not layer.is_finished]

                    # Clean up finished soundboard sounds
                    finished_soundboard_keys = [key for key, layer in self.cached_layers.items()
                                             if key.startswith("soundboard_") and layer.is_finished]
                    for key in finished_soundboard_keys:
                        logger.debug(f"Cleaning up finished soundboard sound {key}")
                        del self.cached_layers[key]

                    if not active_envs and not soundboard_layers:
                        # No active environments or soundboard sounds, stop processing
                        logger.info(
                            "No active environments (playing or fading) or soundboard sounds, stopping audio processing")
                        self.is_running = False
                        next_frame_time += frame_time_ns
                        continue

                    # Clear mix buffers
                    main_mix.fill(0)
                    active_layers = 0

                    # Mix all active environments
                    for env in active_envs:
                        # Calculate environment fade volume
                        env_fade_volume = env.fade_progress

                        # Clear environment mix buffer
                        env_mix.fill(0)
                        env_active_layers = 0

                        # Process each layer in the environment
                        for layer in env.layers:
                            if not layer.sounds:
                                continue

                            # Get or create LayerInfo for this layer
                            layer_info = None

                            # Try to find existing LayerInfo
                            for cache_key in list(self.cached_layers.keys()):
                                if cache_key.startswith(f"{layer.id}_"):
                                    layer_info = self.cached_layers[cache_key]
                                    layer_info.layer = layer
                                    break

                            # If no existing LayerInfo found, create a new one
                            if layer_info is None:
                                if layer.selected_sound_index >= len(layer.sounds):
                                    layer.selected_sound_index = 0
                                selected_sound = layer.sounds[layer.selected_sound_index]
                                layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                                if layer_info is None:
                                    logger.warning(
                                        f"Failed to load layer {layer.id} with sound {selected_sound.file_id}")
                                    continue

                            # Handle layer-level fading
                            layer_sound = layer_info.get_layer_sound()

                            # Get the next chunk - this may trigger a loop point and update active_sound_index
                            chunk = layer_info.get_next_chunk(self.chunk_samples)
                            if chunk is None:
                                continue

                            if layer_info.previous_volume != layer_sound.effective_volume:
                                layer_sound.start_fade_in(layer_info.previous_volume)

                            should_play = layer_info.should_play
                            if should_play and not layer_info.was_playing:
                                layer_sound.start_fade_in(0.0)
                            elif (not should_play and layer_info.was_playing and
                                  layer_info.has_played and not layer_info.is_fading):
                                layer_sound.start_fade_out()

                            if should_play or layer_info.is_fading:
                                # Mix this layer into environment mix
                                env_mix += chunk.astype(np.int32)
                                layer_info.has_played = True

                            layer_info.was_playing = should_play
                            layer_info.previous_volume = layer_sound.effective_volume
                            env_active_layers += 1

                        # If environment had active layers, apply fade volume and add to main mix
                        if env_active_layers > 0:
                            # Convert to float32 for fade volume multiplication
                            env_mix_float = env_mix.astype(np.float32) / 32768.0
                            # Apply fade volume
                            env_mix_float *= env_fade_volume
                            # Convert back to int32 and add to main mix
                            main_mix += (env_mix_float * 32768.0).astype(np.int32)
                            active_layers += env_active_layers

                    # Mix in soundboard sounds
                    for key, layer_info in list(self.cached_layers.items()):
                        if not key.startswith("soundboard_") or layer_info.is_finished:
                            continue

                        # Get the next chunk
                        chunk = layer_info.get_next_chunk(self.chunk_samples)
                        if chunk is None:
                            continue

                        # Get layer sound for volume
                        layer_sound = layer_info.get_layer_sound()
                        if layer_sound:
                            # Convert to float32 for volume multiplication
                            chunk_float = chunk.astype(np.float32) / 32768.0
                            # Apply sound volume
                            chunk_float *= layer_sound.effective_volume
                            # Convert back to int32 and add to main mix
                            main_mix += (chunk_float * 32768.0).astype(np.int32)
                            active_layers += 1

                    if active_layers > 0:
                        chunks_processed += 1

                        # Apply filters to the mixed chunk
                        main_mix = self._apply_filters(main_mix)

                        # Convert to float32 for compression
                        mixed_chunk_float = main_mix.astype(np.float32) / 32768.0

                        # Apply compression
                        mixed_chunk_float = self._apply_compressor(mixed_chunk_float)

                        # Apply speech range dampening
                        mixed_chunk_float = self._apply_speech_dampening(mixed_chunk_float)

                        # Apply master volume
                        if self.app_state:
                            mixed_chunk_float *= self.app_state.master_volume

                        # Convert back to int16 and clip
                        mixed_chunk = np.clip(mixed_chunk_float * 32768.0, -32768, 32767).astype(np.int16)

                        # Convert to bytes and send
                        pcm_data = mixed_chunk.tobytes()
                        if self._bot_manager and hasattr(self._bot_manager, 'audio_manager'):
                            success = self._bot_manager.audio_manager.queue_audio(self._guild_id, pcm_data)
                            if success:
                                chunks_sent += 1
                            else:
                                logger.warning(f"Failed to queue audio data for guild {self._guild_id}")

                    # Update timing and processing overhead estimate
                    processing_time_ns = time.time_ns() - loop_start_ns
                    processing_overhead_ns = (1 - alpha) * processing_overhead_ns + alpha * processing_time_ns
                    next_frame_time += frame_time_ns

        except Exception as e:
            logger.error(f"Main audio processing error: {e}", exc_info=True)
            self.is_running = False

    def start_processing(self, app_state: AppState) -> None:
        """Start audio processing with the given app state.
        
        Args:
            app_state: The current app state to process
        """
        with self.lock:
            if not self._bot_manager:
                logger.warning("Cannot start processing - no bot manager set")
                return

            # Store app state
            self.app_state = app_state

            # Clear any cached layers since we have a new app state
            self.cached_layers.clear()

            # Reset environment states
            self._env_states.clear()
            for env in app_state.environments:
                self._env_states[env.id] = env.play_state

            # Start processing thread if not running
            if not self.is_running:
                self.is_running = True
                self._process_thread = Thread(target=self._process_audio)
                self._process_thread.daemon = True
                self._process_thread.start()
                logger.info("Started audio processing thread")

    def set_bot_manager(self, bot_manager):
        """Set the bot manager instance."""
        self._bot_manager = bot_manager
        logger.info("Bot manager set in AudioMixer")
        if self._guild_id:
            logger.info(f"Using guild ID: {self._guild_id}")
        else:
            logger.warning("No guild ID set in AudioMixer")

    def load_audio_file(self, file_path: Path) -> np.ndarray:
        """Load an audio file and convert it to the correct format."""
        try:
            logger.info(f"Loading audio file: {file_path}")
            audio = AudioSegment.from_file(str(file_path))

            # Log audio file properties
            logger.info(
                f"Audio properties - Duration: {len(audio)}ms, Channels: {audio.channels}," +
                " Sample width: {audio.sample_width}, Frame rate: {audio.frame_rate}")

            # Convert to proper format
            audio = audio.set_frame_rate(self.SAMPLE_RATE)
            audio = audio.set_channels(self.CHANNELS)

            # Convert to numpy array
            samples = np.array(audio.get_array_of_samples())

            # Log array properties
            logger.info(f"Numpy array shape before reshape: {samples.shape}")

            # Reshape if stereo
            if audio.channels == 2:
                samples = samples.reshape((-1, 2))
            else:
                # Convert mono to stereo
                samples = np.column_stack((samples, samples))

            # Log final array properties
            logger.info(f"Final array shape: {samples.shape}, Max value: {np.max(np.abs(samples))}")

            # Normalize to float32 [-1.0, 1.0]
            samples = samples.astype(np.float32) / 32768.0

            return samples

        except Exception as e:
            logger.error(f"Error loading audio file {file_path}: {e}", exc_info=True)
            raise

    def _get_or_load_layer(self, file_id: str, layer: Optional[Layer] = None) -> Optional[LayerInfo]:
        """Get a cached layer or create it if not cached."""
        try:
            if layer is None:
                # Create a minimal layer for standalone sounds
                from audio_processing.models.audio import Layer, LayerSound
                layer = Layer(
                    id=str(uuid.uuid4()),
                    name="Standalone Sound",
                    sounds=[LayerSound(
                        id=str(uuid.uuid4()),
                        file_id=file_id,
                        frequency=1.0,
                        volume=1.0
                    )],
                    chance=1.0,
                    loop_length_ms=999999,
                    mode=LayerMode.SINGLE
                )

            # Create a cache key that includes both the layer ID and the file ID
            cache_key = layer.id if layer.id.startswith("soundboard_") else f"{layer.id}_{file_id}"

            if cache_key in self.cached_layers:
                # Update the layer reference
                self.cached_layers[cache_key].layer = layer
                return self.cached_layers[cache_key]

            # Find the sound file in app state
            if not self.app_state:
                logger.warning("No app state available")
                return None

            sound_file = next(
                (sf for sf in self.app_state.sound_files if sf.id == file_id),
                None
            )
            if not sound_file:
                logger.warning(f"Sound file {file_id} not found in app state")
                return None

            # Use pre-loaded audio data
            if sound_file.audio_data is None:
                logger.error(f"Audio data not loaded for sound file {file_id}")
                return None

            # Create new LayerInfo using preloaded audio data
            layer_info = LayerInfo(
                audio_data=sound_file.audio_data,
                layer=layer
            )

            # Log layer info properties
            logger.info(f"Created LayerInfo - Audio shape: {sound_file.audio_data.shape}, Layer ID: {layer.id}")

            self.cached_layers[cache_key] = layer_info
            return layer_info

        except Exception as e:
            logger.error(f"Error loading layer {file_id}: {e}", exc_info=True)
            return None

    def play_soundboard_sound(self, sound_id: str) -> None:
        """Play a sound from the soundboard once.
        
        Args:
            sound_id: ID of the sound file to play
        """
        with self.lock:
            if not self.app_state:
                logger.warning("Cannot play soundboard sound - no app state")
                return

            # Create a temporary layer for this sound with a consistent ID
            soundboard_layer_id = f"soundboard_{sound_id}"

            # Check if this sound is already playing
            if soundboard_layer_id in self.cached_layers:
                layer_info = self.cached_layers[soundboard_layer_id]
                if not layer_info.is_finished:
                    logger.debug(f"Soundboard sound {sound_id} is already playing")
                    return
                else:
                    # Remove finished sound from cache
                    logger.debug(f"Removing finished soundboard sound {sound_id} from cache")
                    del self.cached_layers[soundboard_layer_id]

            from audio_processing.models.audio import Layer, LayerSound

            # Create temporary objects with weak references to minimize memory leaks
            temp_env = None
            if not self.app_state.environments:
                # Create a temporary environment just for volume settings
                temp_env = Environment(
                    id=str(uuid.uuid4()),
                    name="Temporary Environment",
                    max_weight=1.0,
                    layers=[],
                    presets=[],
                    soundboard=[],
                    play_state=PlayState.PLAYING,
                    app_state=self.app_state
                )
                # Make sure the environment has a reference to app_state for volume settings
                temp_env.app_state = self.app_state
                logger.info("Created temporary environment for soundboard sound")

            layer = Layer(
                id=soundboard_layer_id,  # Use consistent ID
                name="Soundboard Sound",
                sounds=[LayerSound(
                    id=str(uuid.uuid4()),
                    file_id=sound_id,
                    frequency=1.0,
                    volume=1.0  # Base volume at maximum
                )],
                chance=1.0,
                loop_length_ms=999999,
                mode=LayerMode.SINGLE,
                weight=0.0,
                cooldown_cycles=0,
                volume=1.0  # Layer volume at maximum
            )

            # Load the layer
            layer_info = self._get_or_load_layer(sound_id, layer)
            if not layer_info:
                logger.warning(f"Failed to load soundboard sound {sound_id}")
                return

            # Set the layer's environment to access app state for volume normalization
            if self.app_state.environments:
                layer_info.layer.environment = self.app_state.environments[0]
                logger.info(f"Using environment {self.app_state.environments[0].id} for soundboard sound")
            elif temp_env:
                layer_info.layer.environment = temp_env
                logger.info("Using temporary environment for soundboard sound")

            # Force the sound to play once
            layer_info._position = 0  # Reset position to start
            layer_info._audio_position = 0  # Reset audio position
            layer_info.is_finished = False  # Track when the sound is finished

            # Start processing if not running
            if not self.is_running and self._bot_manager:
                self.is_running = True
                self._process_thread = Thread(target=self._process_audio)
                self._process_thread.daemon = True
                self._process_thread.start()
                logger.info("Started audio processing thread for soundboard sound")

            logger.info(f"Playing soundboard sound {sound_id}")


# Create a global instance of the mixer
mixer = AudioMixer()
