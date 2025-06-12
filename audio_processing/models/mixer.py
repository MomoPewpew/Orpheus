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
from audio_processing.models.audio import AppState, PlayState

logger = logging.getLogger(__name__)

# Define audio file directory
AUDIO_DIR = Path(__file__).parent.parent / 'data' / 'audio'

class LayerInfo:
    """Represents a single audio layer in the streaming mix."""
    
    def __init__(self, audio_data: np.ndarray, loop_length_ms: float, volume: float = 1.0):
        """Initialize a new audio layer.
        
        Args:
            audio_data: Numpy array of audio samples (shape: [samples, channels])
            loop_length_ms: Length of the loop in milliseconds
            volume: Initial volume multiplier (0.0 to 1.0)
        """
        # Convert float32 [-1.0, 1.0] to int16 PCM
        self.audio_data = (audio_data * 32767).astype(np.int16)
        self.loop_length_samples = int(AudioMixer.SAMPLE_RATE * (loop_length_ms / 1000))
        self.volume = volume
        self._position = 0
        logger.debug(f"Initialized layer with {len(audio_data)} samples, loop length: {self.loop_length_samples} samples")
        
    def get_next_chunk(self, chunk_size: int, current_time_ms: float) -> np.ndarray:
        """Get the next chunk of audio data.
        
        Args:
            chunk_size: Number of samples to return
            current_time_ms: Current stream time in milliseconds (unused, kept for compatibility)
            
        Returns:
            Numpy array of audio samples for this chunk
        """
        try:
            # Handle loop wraparound
            if self._position + chunk_size > self.loop_length_samples:
                # Need to wrap around
                first_part = self.audio_data[self._position:self.loop_length_samples]
                second_part = self.audio_data[:chunk_size - len(first_part)]
                chunk = np.concatenate([first_part, second_part])
                self._position = len(second_part)
            else:
                # Get chunk and update position
                chunk = self.audio_data[self._position:self._position + chunk_size]
                self._position = (self._position + chunk_size) % self.loop_length_samples
            
            # Apply volume
            if self.volume != 1.0:
                # Convert back to float32, apply volume, then back to int16
                chunk = (chunk.astype(np.float32) * self.volume).astype(np.int16)
            
            return chunk
            
        except Exception as e:
            logger.error(f"Error getting next chunk: {e}")
            return np.zeros((chunk_size, AudioMixer.CHANNELS), dtype=np.int16)

class AudioMixer:
    """Handles mixing and streaming of audio layers."""
    
    # Audio configuration
    SAMPLE_RATE = 48000  # Hz
    CHANNELS = 2
    CHUNK_MS = 20        # Size of processing chunks in milliseconds
    
    def __init__(self):
        """Initialize the audio mixer."""
        self.chunk_samples = int(self.SAMPLE_RATE * (self.CHUNK_MS / 1000))
        self._lock = Lock()
        self._bot_manager = None
        self._is_running = False
        self._process_thread: Optional[Thread] = None
        self._guild_id: Optional[int] = None
        self._app_state: Optional[AppState] = None
        self._cached_layers: Dict[str, LayerInfo] = {}
        
    def _process_audio(self):
        """Main audio processing loop."""
        try:
            logger.info("Starting main audio processing loop")
            last_process_time = time.time()
            frame_time = self.CHUNK_MS / 1000  # Convert to seconds
            
            while self._is_running:
                current_time = time.time()
                process_time = current_time - last_process_time
                
                if process_time < frame_time:
                    # Wait until it's time for the next frame
                    time.sleep(frame_time - process_time)
                    current_time = time.time()
                
                with self._lock:
                    if not self._app_state or not self._guild_id:
                        continue
                        
                    # Process each playing environment
                    playing_envs = [env for env in self._app_state.environments if env.play_state == PlayState.PLAYING]
                    if not playing_envs:
                        continue
                    
                    # Initialize mix buffer as int32 for headroom during mixing
                    mixed_chunk = np.zeros((self.chunk_samples, self.CHANNELS), dtype=np.int32)
                    active_layers = 0
                    
                    # Mix all active layers
                    for env in playing_envs:
                        env_data = env.to_dict()
                        for layer in env_data.get('layers', []):
                            sounds = layer.get('sounds', [])
                            if not sounds:
                                continue
                                
                            first_sound = sounds[0]
                            file_id = first_sound.get('fileId')
                            if not file_id:
                                continue
                                
                            # Get or load the layer
                            layer_info = self._get_or_load_layer(file_id)
                            if not layer_info:
                                continue
                                
                            # Calculate layer volume
                            sound_volume = first_sound.get('volume', 1.0)
                            layer_volume = layer.get('volume', 1.0)
                            layer_info.volume = sound_volume * layer_volume
                            
                            # Mix this layer
                            chunk = layer_info.get_next_chunk(self.chunk_samples, 0)
                            mixed_chunk += chunk.astype(np.int32)
                            active_layers += 1
                    
                    if active_layers > 0:
                        # Normalize mix to prevent clipping
                        mixed_chunk = np.clip(mixed_chunk, -32768, 32767).astype(np.int16)
                        
                        # Convert to bytes and send
                        pcm_data = mixed_chunk.tobytes()
                        if self._bot_manager and hasattr(self._bot_manager, 'audio_manager'):
                            success = self._bot_manager.audio_manager.queue_audio(self._guild_id, pcm_data)
                            if not success:
                                logger.warning(f"Failed to queue audio data for guild {self._guild_id}")
                
                last_process_time = current_time
                
        except Exception as e:
            logger.error(f"Main audio processing error: {e}")
            self._is_running = False

    def start_processing(self, app_state: AppState) -> None:
        """Start the audio processing loop with the given state.
        
        Args:
            app_state: The current application state
        """
        with self._lock:
            logger.info("Starting audio processing with new app state")
            # Log environment states
            for env in app_state.environments:
                logger.debug(f"Environment {env.id} state: {env.play_state}")
                
            self._app_state = app_state
            
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
            
    def _get_or_load_layer(self, file_id: str) -> Optional[LayerInfo]:
        """Get a cached layer or load it if not cached."""
        if file_id not in self._cached_layers:
            try:
                sound_path = AUDIO_DIR / f"{file_id}.mp3"
                if not sound_path.exists():
                    logger.warning(f"Audio file not found: {sound_path}")
                    return None
                    
                audio_data = self._load_audio_file(sound_path)
                self._cached_layers[file_id] = LayerInfo(
                    audio_data=audio_data,
                    loop_length_ms=len(audio_data) * 1000 / self.SAMPLE_RATE,
                    volume=1.0  # Base volume, will be adjusted by environment settings
                )
            except Exception as e:
                logger.error(f"Error loading layer {file_id}: {e}")
                return None
                
        return self._cached_layers[file_id]

# Create a global instance of the mixer
mixer = AudioMixer() 