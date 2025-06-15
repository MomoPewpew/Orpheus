import logging
import io
import os
import time
import numpy as np
from math import log10
from pathlib import Path
from typing import List, Dict, Any, Optional
from collections import deque
from threading import Lock, Thread
from pydub import AudioSegment
from flask import current_app
from audio_processing.models.audio import AppState, PlayState, Layer, LayerMode
from audio_processing.models.layer_info import LayerInfo
import uuid
import random
from scipy import signal

logger = logging.getLogger(__name__)

# Define audio file directory
AUDIO_DIR = Path(__file__).parent.parent / 'data' / 'audio'

class AudioMixer:
    """Handles mixing and streaming of audio layers."""
    
    # Audio configuration
    SAMPLE_RATE = 48000  # Hz
    CHANNELS = 2
    CHUNK_MS = 20        # Size of processing chunks in milliseconds
    TARGET_BUFFER_MS = 100  # Target buffer size in Discord (in milliseconds)
    
    # Speech range configuration
    SPEECH_CENTER_FREQ = 1250.0  # Center frequency (Hz) - middle of speech range 500-2000 Hz
    SPEECH_BANDWIDTH = 1500.0    # Width of the affected range (Hz)
    
    def __init__(self):
        """Initialize the audio mixer."""
        self.chunk_samples = int(self.SAMPLE_RATE * (self.CHUNK_MS / 1000))
        self.target_buffer_chunks = self.TARGET_BUFFER_MS // self.CHUNK_MS
        self._lock = Lock()
        self._bot_manager = None
        self._is_running = False
        self._process_thread: Optional[Thread] = None
        self._guild_id: Optional[int] = None
        self._app_state: Optional[AppState] = None
        self._cached_layers: Dict[str, LayerInfo] = {}
        self._last_chunk_time = 0
        self._chunks_queued = 0
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
        if not self._app_state:
            return chunk
        
        # Get filter frequencies
        high_pass_freq = self._app_state.effects.filters.high_pass.frequency
        low_pass_freq = self._app_state.effects.filters.low_pass.frequency

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
        if not self._app_state:
            return chunk
            
        # Get compressor ratio
        ratio = self._app_state.effects.compressor.ratio

        if ratio == 1.0:
            return chunk
    
        # Get compressor settings
        low_threshold = self._app_state.effects.compressor.lowThreshold
        high_threshold = self._app_state.effects.compressor.highThreshold
        
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
                    gain_db = -db_above * (1 - 1/ratio)
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
        if not self._app_state or not self._bot_manager:
            return chunk
            
        # Get dampening settings
        dampen = self._app_state.effects.filters.dampen_speech_range
        if dampen.amount == 0.0:
            return chunk

        # Check for voice activity using our guild_id
        if not self._bot_manager.has_voice_activity(self._guild_id):
            return chunk
                        
        try:
            # Create three bandpass filters to cover different parts of the speech range
            nyquist = self.SAMPLE_RATE / 2
            
            # Low speech range (fundamental frequencies)
            low_speech = (100/nyquist, 600/nyquist)
            # Mid speech range (vowels)
            mid_speech = (600/nyquist, 2000/nyquist)
            # High speech range (consonants)
            high_speech = (2000/nyquist, 4000/nyquist)
            
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
            
            # Track audio stats
            last_stats_time = time.time()
            chunks_processed = 0
            chunks_sent = 0
            
            while self._is_running:
                current_time_ns = time.time_ns()
                
                # Log stats every 5 seconds
                current_time = time.time()
                if current_time - last_stats_time >= 5:
                    logger.info(f"Audio stats: {chunks_processed} chunks processed, {chunks_sent} chunks sent in last 5s")
                    chunks_processed = 0
                    chunks_sent = 0
                    last_stats_time = current_time
                
                # Check if it's time for the next frame
                if current_time_ns < next_frame_time:
                    # Use a shorter sleep to be more precise
                    sleep_time = (next_frame_time - current_time_ns) / 1_000_000_000  # Convert to seconds
                    if sleep_time > 0.001:  # If we need to sleep more than 1ms
                        time.sleep(sleep_time - 0.001)  # Sleep slightly less
                    continue
                
                # If we're more than one frame behind, skip frames to catch up
                frames_behind = (current_time_ns - next_frame_time) // frame_time_ns
                if frames_behind > 0:
                    logger.debug(f"Skipping {frames_behind} frames to catch up")
                    next_frame_time += frame_time_ns * frames_behind
                
                with self._lock:
                    if not self._app_state or not self._guild_id:
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
                            logger.debug(f"Buffer full ({buffer_size} chunks), waiting")
                            next_frame_time += frame_time_ns
                            continue
                    
                    # Update environment states and detect transitions
                    current_env_states = {env.id: env.play_state for env in self._app_state.environments}
                    
                    # Check for transitions and reset layers if needed
                    for env in self._app_state.environments:
                        last_state = self._env_states.get(env.id)
                        if env.play_state == PlayState.PLAYING and last_state == PlayState.STOPPED:
                            logger.info(f"Environment {env.id} transitioned from STOPPED to PLAYING - resetting layers")
                            
                            # Clear any existing cached layers for this environment
                            for layer in env.layers:
                                if not layer.sounds:
                                    continue
                                # Find and clear all cached layers for this environment
                                stale_cache_keys = [
                                    key for key in list(self._cached_layers.keys())
                                    if key.startswith(f"{layer.id}_")
                                ]
                                for key in stale_cache_keys:
                                    logger.info(f"Clearing stale layer cache: {key}")
                                    del self._cached_layers[key]
                                    
                                # Load and reset the layer
                                if layer.selected_sound_index >= len(layer.sounds):
                                    layer.selected_sound_index = 0
                                selected_sound = layer.sounds[layer.selected_sound_index]
                                layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                                if layer_info:
                                    logger.info(f"Reset layer {layer.id} with sound {selected_sound.file_id}")
                                    layer_info.reset_position()
                                    layer_info._should_play = True
                                    logger.info(f"Layer {layer.id} ready to play")
                    
                    # Update stored states
                    self._env_states = current_env_states
                    
                    # Process each playing environment
                    playing_envs = [env for env in self._app_state.environments if env.play_state == PlayState.PLAYING or env.is_fading]
                    
                    # Check for active soundboard sounds - only include those that haven't finished playing
                    soundboard_layers = [layer for key, layer in self._cached_layers.items() 
                                      if key.startswith("soundboard_") and layer._should_play and not layer._is_finished]
                    
                    # Pre-check if any environments have non-zero fade volume
                    active_envs = [env for env in playing_envs if env.fade_progress > 0]
                    
                    if not active_envs and not soundboard_layers:
                        # No active environments or soundboard sounds, stop processing
                        logger.info("No active environments (with fade > 0) or soundboard sounds, stopping audio processing")
                        self._is_running = False
                        next_frame_time += frame_time_ns
                        continue
                    
                    # Initialize mix buffer as int32 for headroom during mixing
                    mixed_chunk = np.zeros((self.chunk_samples, self.CHANNELS), dtype=np.int32)
                    active_layers = 0
                    
                    # Log active environments and layers
                    logger.debug(f"Processing {len(active_envs)} active environments (fade > 0) and {len(soundboard_layers)} soundboard layers")
                    
                    # Mix all active layers from environments
                    for env in active_envs:  # Only process environments with fade > 0
                        # Calculate environment fade volume
                        env_fade_volume = env.fade_progress
                        logger.debug(f"Processing environment {env.id} with fade volume {env_fade_volume}")
                        
                        # Create a mix buffer for this environment
                        env_mix = np.zeros((self.chunk_samples, self.CHANNELS), dtype=np.int32)
                        env_active_layers = 0
                        
                        # Process each layer in the environment
                        for layer in env.layers:
                            if not layer.sounds:
                                continue
                                
                            logger.debug(f"Processing layer {layer.id} in environment {env.id}")
                            
                            # Get or create LayerInfo for this layer
                            layer_info = None
                            current_file_id = None
                            
                            # Try to find existing LayerInfo
                            for cache_key in list(self._cached_layers.keys()):
                                if cache_key.startswith(f"{layer.id}_"):
                                    layer_info = self._cached_layers[cache_key]
                                    current_file_id = cache_key.split('_')[1]
                                    layer_info.layer = layer
                                    break
                            
                            # Create new LayerInfo if needed
                            if not layer_info:
                                if layer.selected_sound_index >= len(layer.sounds):
                                    layer.selected_sound_index = 0
                                selected_sound = layer.sounds[layer.selected_sound_index]
                                layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                                if not layer_info:
                                    logger.error(f"Failed to load layer info for sound {selected_sound.file_id}")
                                    continue
                                current_file_id = selected_sound.file_id
                            
                            # Get the next chunk - this may trigger a loop point and update active_sound_index
                            logger.debug(f"Getting next chunk for layer {layer.id} at position {layer_info._position} (total samples: {layer_info.audio_length_samples})")
                            chunk = layer_info.get_next_chunk(self.chunk_samples, 0)
                            if chunk is None:
                                logger.debug(f"No audio chunk available for layer {layer.id}")
                                continue
                            
                            # Log audio levels and chunk properties
                            max_level = np.max(np.abs(chunk))
                            logger.debug(f"Layer {layer.id} chunk - Shape: {chunk.shape}, Max level: {max_level}, Position: {layer_info._position}, Audio length: {layer_info.audio_length_samples}")
                            
                            # Mix this layer into environment mix
                            env_mix += chunk.astype(np.int32)
                            env_active_layers += 1
                            
                        # If environment had active layers, apply fade volume and add to main mix
                        if env_active_layers > 0:
                            # Convert to float32 for fade volume multiplication
                            env_mix_float = env_mix.astype(np.float32) / 32768.0
                            # Apply fade volume
                            env_mix_float *= env_fade_volume
                            # Convert back to int32 and add to main mix
                            mixed_chunk += (env_mix_float * 32768.0).astype(np.int32)
                            active_layers += env_active_layers
                    
                    if active_layers > 0:
                        chunks_processed += 1
                        
                        # Log final mix levels before effects
                        max_level = np.max(np.abs(mixed_chunk))
                        logger.debug(f"Final mix level before effects: {max_level}")
                        
                        # Apply filters to the mixed chunk
                        mixed_chunk = self._apply_filters(mixed_chunk)
                        
                        # Convert to float32 for compression
                        mixed_chunk_float = mixed_chunk.astype(np.float32) / 32768.0
                        
                        # Apply compression
                        mixed_chunk_float = self._apply_compressor(mixed_chunk_float)
                        
                        # Apply speech range dampening
                        mixed_chunk_float = self._apply_speech_dampening(mixed_chunk_float)
                        
                        # Apply master volume
                        if self._app_state:
                            mixed_chunk_float *= self._app_state.master_volume
                            logger.debug(f"Applied master volume: {self._app_state.master_volume}")
                        
                        # Convert back to int16 and clip
                        mixed_chunk = np.clip(mixed_chunk_float * 32768.0, -32768, 32767).astype(np.int16)
                        
                        # Log final output levels
                        max_level = np.max(np.abs(mixed_chunk))
                        logger.debug(f"Final output level: {max_level}")
                        
                        # Convert to bytes and send
                        pcm_data = mixed_chunk.tobytes()
                        if self._bot_manager and hasattr(self._bot_manager, 'audio_manager'):
                            success = self._bot_manager.audio_manager.queue_audio(self._guild_id, pcm_data)
                            if success:
                                chunks_sent += 1
                                logger.debug("Successfully queued audio chunk")
                            else:
                                logger.warning(f"Failed to queue audio data for guild {self._guild_id}")
                    
                    # Update timing
                    next_frame_time += frame_time_ns
                
        except Exception as e:
            logger.error(f"Main audio processing error: {e}", exc_info=True)
            self._is_running = False

    def start_processing(self, app_state: AppState) -> None:
        """Start the audio processing loop with the given state.
        
        Args:
            app_state: The current application state
        """
        with self._lock:
            logger.info("Starting audio processing with new app state")
            
            # Reset processing state
            self._is_running = False
            if self._process_thread and self._process_thread.is_alive():
                logger.info("Waiting for existing processing thread to stop")
                self._process_thread.join(timeout=1.0)
            self._process_thread = None
            
            # Clear all cached layers to ensure fresh start
            self._cached_layers.clear()
            self._env_states.clear()
            
            # Ensure we have a bot manager and guild ID
            if not self._bot_manager:
                logger.error("No bot manager set - cannot start processing")
                return
                
            if not self._guild_id and hasattr(self._bot_manager, 'guild_id'):
                self._guild_id = self._bot_manager.guild_id
                logger.info(f"Set guild ID to {self._guild_id}")
            
            if not self._guild_id:
                logger.error("No guild ID set - cannot start processing")
                return
            
            # Ensure voice client is connected
            if hasattr(self._bot_manager, 'ensure_voice_client'):
                logger.info("Ensuring voice client is connected")
                try:
                    self._bot_manager.ensure_voice_client(self._guild_id)
                    # Wait a short time for the voice client to be ready
                    time.sleep(0.5)
                except Exception as e:
                    logger.error(f"Failed to connect voice client: {e}")
                    return

            # First, ensure all environment layers are loaded and reset
            for env in app_state.environments:
                # Reset positions for all environments, not just playing ones
                logger.info(f"Loading and resetting layers for environment {env.id}")
                for layer in env.layers:
                    if not layer.sounds:
                        continue
                    # Load the selected sound for this layer
                    if layer.selected_sound_index >= len(layer.sounds):
                        layer.selected_sound_index = 0
                    selected_sound = layer.sounds[layer.selected_sound_index]
                    
                    # Create or get the layer info
                    layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                    if layer_info:
                        logger.info(f"Loaded layer {layer.id} with sound {selected_sound.file_id}")
                        # Always reset position for all layers
                        layer_info.reset_position()
                        layer_info._should_play = env.play_state == PlayState.PLAYING
                        logger.info(f"Reset position for layer {layer.id} (_should_play: {layer_info._should_play})")
                
            # Store initial environment states
            self._env_states = {env.id: env.play_state for env in app_state.environments}
            self._app_state = app_state
            
            # Log the state before starting
            playing_envs = [env for env in app_state.environments if env.play_state == PlayState.PLAYING]
            logger.info(f"Starting processing with {len(playing_envs)} playing environments")
            for env in playing_envs:
                logger.info(f"Environment {env.id} is playing with {len(env.layers)} layers")
                for layer in env.layers:
                    if layer.sounds:
                        logger.info(f"Layer {layer.id} has {len(layer.sounds)} sounds, selected: {layer.selected_sound_index}")
            
            # Start the processing thread
            self._is_running = True
            self._process_thread = Thread(target=self._process_audio)
            self._process_thread.daemon = True
            self._process_thread.start()
            logger.info("Started main audio processing thread")

    def stop_processing(self) -> None:
        """Stop the audio processing loop."""
        with self._lock:
            logger.info("Stopping audio processing")
            self._is_running = False
            if self._process_thread and self._process_thread.is_alive():
                self._process_thread.join(timeout=1.0)
            self._process_thread = None
            self._app_state = None
            logger.info("Stopped main audio processing thread")

    def set_bot_manager(self, bot_manager):
        """Set the bot manager instance."""
        self._bot_manager = bot_manager
        logger.info("Bot manager set in AudioMixer")
        if self._guild_id:
            logger.info(f"Using guild ID: {self._guild_id}")
        else:
            logger.warning("No guild ID set in AudioMixer")
        
    def _load_audio_file(self, file_path: Path) -> np.ndarray:
        """Load an audio file and convert it to the correct format."""
        try:
            logger.info(f"Loading audio file: {file_path}")
            audio = AudioSegment.from_file(str(file_path))
            
            # Log audio file properties
            logger.info(f"Audio properties - Duration: {len(audio)}ms, Channels: {audio.channels}, Sample width: {audio.sample_width}, Frame rate: {audio.frame_rate}")
            
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
        """Get a cached layer or load it if not cached."""
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
                    loop_length_ms=8000,  # Default 8 seconds
                    mode=LayerMode.SINGLE
                )
            
            # Create a cache key that includes both the layer ID and the file ID
            cache_key = layer.id if layer.id.startswith("soundboard_") else f"{layer.id}_{file_id}"
            
            if cache_key in self._cached_layers:
                logger.debug(f"Using cached layer: {cache_key}")
                # Update the layer reference
                self._cached_layers[cache_key].layer = layer
                return self._cached_layers[cache_key]
            
            # Load new layer
            sound_path = AUDIO_DIR / f"{file_id}.mp3"
            if not sound_path.exists():
                logger.warning(f"Audio file not found: {sound_path}")
                return None
                
            logger.info(f"Loading new layer: {cache_key} from {sound_path}")
            audio_data = self._load_audio_file(sound_path)
            
            # Create new LayerInfo
            layer_info = LayerInfo(
                audio_data=audio_data,
                layer=layer
            )
            
            # Log layer info properties
            logger.info(f"Created LayerInfo - Audio shape: {audio_data.shape}, Layer ID: {layer.id}")
            
            self._cached_layers[cache_key] = layer_info
            return layer_info
            
        except Exception as e:
            logger.error(f"Error loading layer {file_id}: {e}", exc_info=True)
            return None

    def play_soundboard_sound(self, sound_id: str) -> None:
        """Play a sound from the soundboard once.
        
        Args:
            sound_id: ID of the sound file to play
        """
        with self._lock:
            if not self._app_state:
                logger.warning("Cannot play soundboard sound - no app state")
                return
                
            # Create a temporary layer for this sound with a consistent ID
            soundboard_layer_id = f"soundboard_{sound_id}"
            
            # Check if this sound is already playing
            if soundboard_layer_id in self._cached_layers:
                logger.debug(f"Soundboard sound {sound_id} is already playing")
                return
                
            from audio_processing.models.audio import Layer, LayerSound, Environment
            
            # Create temporary objects with weak references to minimize memory leaks
            temp_env = None
            if not self._app_state.environments:
                # Create a temporary environment just for volume settings
                temp_env = Environment(
                    id=str(uuid.uuid4()),
                    name="Temporary Environment",
                    max_weight=1.0,
                    layers=[],
                    presets=[],
                    soundboard=[],
                    play_state=PlayState.PLAYING,
                    _app_state=self._app_state
                )
            
            layer = Layer(
                id=soundboard_layer_id,  # Use consistent ID
                name="Soundboard Sound",
                sounds=[LayerSound(
                    id=str(uuid.uuid4()),
                    file_id=sound_id,
                    frequency=1.0,
                    volume=1.0
                )],
                chance=1.0,
                loop_length_ms=None,  # Don't loop at all
                mode=LayerMode.SINGLE
            )
            
            # Load the layer
            layer_info = self._get_or_load_layer(sound_id, layer)
            if not layer_info:
                logger.warning(f"Failed to load soundboard sound {sound_id}")
                return
                
            # Set the layer's environment to access app state for volume normalization
            if self._app_state.environments:
                layer_info.layer._environment = self._app_state.environments[0]
            elif temp_env:
                layer_info.layer._environment = temp_env
                
            # Force the sound to play once
            layer_info._should_play = True
            layer_info._position = 0  # Reset position to start
            layer_info._audio_position = 0  # Reset audio position
            layer_info._is_finished = False  # Track when the sound is finished
            
            # Start processing if not running
            if not self._is_running and self._bot_manager:
                self._is_running = True
                self._process_thread = Thread(target=self._process_audio)
                self._process_thread.daemon = True
                self._process_thread.start()
                logger.info("Started audio processing thread for soundboard sound")
            
            logger.info(f"Playing soundboard sound {sound_id}")

# Create a global instance of the mixer
mixer = AudioMixer() 