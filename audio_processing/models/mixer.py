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
from audio_processing.models.audio import AppState, PlayState, Layer
from audio_processing.models.layer_info import LayerInfo
import uuid
import random

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
        
    def _process_audio(self):
        """Main audio processing loop."""
        try:
            logger.info("Starting main audio processing loop")
            
            # Initialize timing
            frame_time_ns = int(self.CHUNK_MS * 1_000_000)  # Convert to nanoseconds
            next_frame_time = time.time_ns()
            
            while self._is_running:
                current_time_ns = time.time_ns()
                
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
                        next_frame_time += frame_time_ns
                        continue
                    
                    # Check Discord's buffer status
                    if hasattr(self._bot_manager, 'audio_manager'):
                        buffer_size = self._bot_manager.audio_manager.get_buffer_size(self._guild_id)
                        if buffer_size and buffer_size >= self.target_buffer_chunks:
                            logger.debug(f"Buffer full ({buffer_size} chunks), waiting")
                            next_frame_time += frame_time_ns
                            continue
                    
                    # Process each playing environment
                    playing_envs = [env for env in self._app_state.environments if env.play_state == PlayState.PLAYING]
                    if not playing_envs:
                        next_frame_time += frame_time_ns
                        continue
                    
                    # Initialize mix buffer as int32 for headroom during mixing
                    mixed_chunk = np.zeros((self.chunk_samples, self.CHANNELS), dtype=np.int32)
                    active_layers = 0
                    
                    # Mix all active layers
                    for env in playing_envs:
                        # Use the actual Layer objects from the environment
                        for layer in env.layers:
                            if not layer.sounds:
                                continue
                                
                            # First, try to find an existing LayerInfo for this layer
                            layer_info = None
                            current_file_id = None
                            for cache_key in list(self._cached_layers.keys()):
                                if cache_key.startswith(f"{layer.id}_"):
                                    layer_info = self._cached_layers[cache_key]
                                    # Get the current file ID from the cache key
                                    current_file_id = cache_key.split('_')[1]
                                    # Update layer reference
                                    layer_info.layer = layer
                                    break
                            
                            # If no LayerInfo exists, create one with the selected sound
                            if not layer_info:
                                if layer.selected_sound_index >= len(layer.sounds):
                                    layer.selected_sound_index = 0
                                selected_sound = layer.sounds[layer.selected_sound_index]
                                layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                                if not layer_info:
                                    continue
                                current_file_id = selected_sound.file_id
                            
                            # Get the next chunk - this may trigger a loop point and update active_sound_index
                            chunk = layer_info.get_next_chunk(self.chunk_samples, 0)
                            
                            # After getting the chunk, check if we need to switch to a different sound
                            active_sound = layer_info.get_layer_sound()
                            if not active_sound:
                                continue
                                
                            active_file_id = active_sound.file_id
                            
                            # If the active sound is different from what we're currently playing
                            if active_file_id != current_file_id:
                                cache_key = f"{layer.id}_{active_file_id}"
                                if cache_key not in self._cached_layers:
                                    # Load the new sound's audio
                                    new_layer_info = self._get_or_load_layer(active_file_id, layer)
                                    if not new_layer_info:
                                        continue
                                    # Copy over the active index and position
                                    new_layer_info._active_sound_index = layer_info._active_sound_index
                                    new_layer_info._position = 0
                                    new_layer_info._audio_position = 0
                                    # Store in cache and use this LayerInfo
                                    self._cached_layers[cache_key] = new_layer_info
                                    layer_info = new_layer_info
                                else:
                                    # Use the cached version
                                    layer_info = self._cached_layers[cache_key]
                                    layer_info.layer = layer
                                # Get the first chunk from the new sound
                                chunk = layer_info.get_next_chunk(self.chunk_samples, 0)
                            
                            # Apply effective volume (considering layer volume, sound volume, and preset overrides)
                            volume = layer_info.volume
                            if volume != 1.0:
                                chunk = (chunk.astype(np.float32) * volume).astype(np.int16)
                            
                            # Mix this layer
                            mixed_chunk += chunk.astype(np.int32)
                            active_layers += 1
                    
                    if active_layers > 0:
                        # Normalize mix to prevent clipping
                        mixed_chunk = np.clip(mixed_chunk, -32768, 32767).astype(np.int16)
                        
                        # Convert to bytes and send
                        pcm_data = mixed_chunk.tobytes()
                        if self._bot_manager and hasattr(self._bot_manager, 'audio_manager'):
                            success = self._bot_manager.audio_manager.queue_audio(self._guild_id, pcm_data)
                            if success:
                                self._chunks_queued += 1
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

            # First, ensure all layers are loaded
            for env in app_state.environments:
                for layer in env.layers:
                    if not layer.sounds:
                        continue
                    # Load the selected sound for this layer
                    if layer.selected_sound_index >= len(layer.sounds):
                        layer.selected_sound_index = 0
                    selected_sound = layer.sounds[layer.selected_sound_index]
                    layer_info = self._get_or_load_layer(selected_sound.file_id, layer)
                    if layer_info:
                        logger.debug(f"Loaded layer {layer.id} with sound {selected_sound.file_id}")

            # Reset all layer positions and cooldowns
            for layer_info in self._cached_layers.values():
                layer_info.reset_position()  # This resets cooldown state
                
            # Clear any stale layer caches for environments that are no longer present
            current_layer_ids = {layer.id for env in app_state.environments for layer in env.layers}
            stale_cache_keys = [
                key for key in list(self._cached_layers.keys())
                if key.split('_')[0] not in current_layer_ids
            ]
            for key in stale_cache_keys:
                del self._cached_layers[key]
                
            self._app_state = app_state
            
            # Do initial weight checks for each environment
            for env in app_state.environments:
                if env.play_state != PlayState.PLAYING:
                    continue
                    
                # Get all LayerInfo instances for this environment's layers
                env_layers = []
                for layer in env.layers:
                    if not layer.sounds:
                        continue
                    # Find the LayerInfo for the current sound
                    current_sound = layer.sounds[layer.selected_sound_index]
                    cache_key = f"{layer.id}_{current_sound.file_id}"
                    if cache_key in self._cached_layers:
                        env_layers.append(self._cached_layers[cache_key])
                
                # Check weights for this environment's layers
                if env_layers:
                    logger.debug(f"Checking initial weights for environment with {len(env_layers)} layers")
                    LayerInfo.check_initial_weights(env_layers)
            
            if not self._is_running:
                self._is_running = True
                self._process_thread = Thread(target=self._process_audio)
                self._process_thread.daemon = True
                self._process_thread.start()
                logger.info("Started main audio processing thread")
            else:
                logger.warning("Audio processing already running")

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
            audio = AudioSegment.from_file(str(file_path))
            
            # Convert to proper format
            audio = audio.set_frame_rate(self.SAMPLE_RATE)
            audio = audio.set_channels(self.CHANNELS)
            
            # Convert to numpy array
            samples = np.array(audio.get_array_of_samples())
            
            # Reshape if stereo
            if audio.channels == 2:
                samples = samples.reshape((-1, 2))
            else:
                # Convert mono to stereo
                samples = np.column_stack((samples, samples))
                
            # Normalize to float32 [-1.0, 1.0]
            samples = samples.astype(np.float32) / 32768.0
            
            return samples
            
        except Exception as e:
            logger.error(f"Error loading audio file {file_path}: {e}")
            raise
            
    def _get_or_load_layer(self, file_id: str, layer: Optional[Layer] = None) -> Optional[LayerInfo]:
        """Get a cached layer or load it if not cached.
        
        Args:
            file_id: ID of the sound file to load
            layer: The Layer object containing configuration
        """
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
            cache_key = f"{layer.id}_{file_id}"
            
            if cache_key in self._cached_layers:
                # Update the layer reference
                self._cached_layers[cache_key].layer = layer
                return self._cached_layers[cache_key]
            
            # Load new layer
            sound_path = AUDIO_DIR / f"{file_id}.mp3"
            if not sound_path.exists():
                logger.warning(f"Audio file not found: {sound_path}")
                return None
                
            audio_data = self._load_audio_file(sound_path)
            
            # Create new LayerInfo
            self._cached_layers[cache_key] = LayerInfo(
                audio_data=audio_data,
                layer=layer
            )
            return self._cached_layers[cache_key]
            
        except Exception as e:
            logger.error(f"Error loading layer {file_id}: {e}")
            return None

# Create a global instance of the mixer
mixer = AudioMixer() 