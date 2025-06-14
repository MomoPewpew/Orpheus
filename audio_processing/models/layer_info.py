import logging
import random
import numpy as np
from typing import Dict, Any, Optional
from audio_processing.models.audio import LayerSound, LayerMode, Layer

logger = logging.getLogger(__name__)

class LayerInfo:
    """Represents a single audio layer in the streaming mix."""
    
    # Audio configuration
    SAMPLE_RATE = 48000  # Hz
    CHANNELS = 2
    
    def __init__(self, audio_data: np.ndarray, layer: Layer):
        """Initialize a new audio layer.
        
        Args:
            audio_data: Numpy array of audio samples (shape: [samples, channels])
            layer: The Layer object containing configuration and sounds
        """
        # Convert float32 [-1.0, 1.0] to int16 PCM
        self.audio_data = (audio_data * 32767).astype(np.int16)
        self.audio_length_samples = len(self.audio_data)
        self.layer = layer
        self._position = 0  # Position within the loop
        self._audio_position = 0  # Position within the audio data
        # Initialize active_sound_index to the selected sound index
        self._active_sound_index = layer.selected_sound_index
        # Initialize chance state - don't roll yet, wait for first cycle
        self._should_play = False
    
    @property
    def loop_length_samples(self) -> int:
        """Get the current loop length in samples, based on layer configuration."""
        loop_length_ms = self.layer.loop_length_ms or 8000  # Default 8 seconds
        return int(self.SAMPLE_RATE * (loop_length_ms / 1000))
    
    @property
    def volume(self) -> float:
        """Get the current volume, based on layer and sound configuration."""
        if not self.layer.sounds:
            return self.layer.volume
            
        # Get the selected sound
        sound = self.get_layer_sound()
        if not sound:
            return self.layer.volume
            
        return sound.get_effective_volume()
        
    def get_layer_sound(self) -> Optional[LayerSound]:
        """Get the currently active LayerSound."""
        if not self.layer.sounds:
            return None
        
        # Ensure active_sound_index is within bounds
        if self._active_sound_index >= len(self.layer.sounds):
            self._active_sound_index = 0
            
        return self.layer.sounds[self._active_sound_index]

    def update_active_sound_index(self):
        """Update the active sound index based on the layer mode when a loop completes."""
        if not self.layer.sounds:
            return
            
        old_index = self._active_sound_index
        
        if self.layer.mode == LayerMode.SINGLE:
            # In single mode, always use the selected sound
            self._active_sound_index = self.layer.selected_sound_index
        elif self.layer.mode == LayerMode.SEQUENCE:
            # In sequence mode, increment the index
            self._active_sound_index = (self._active_sound_index + 1) % len(self.layer.sounds)
        elif self.layer.mode == LayerMode.SHUFFLE:
            # In shuffle mode, pick a random sound based on frequency weights
            import random
            
            # Get effective frequencies (considering preset overrides)
            frequencies = [sound.get_effective_frequency() for sound in self.layer.sounds]
            
            # Use weighted choice based on frequencies
            self._active_sound_index = random.choices(
                range(len(self.layer.sounds)), 
                weights=frequencies,
                k=1
            )[0]
            
        # Ensure the index is within bounds
        if self._active_sound_index >= len(self.layer.sounds):
            self._active_sound_index = 0
            
    def reset_position(self):
        """Reset the playback position to the start of the audio."""
        self._position = 0
        self._audio_position = 0
        # Roll chance when resetting position (starting a new cycle)
        self._should_play = random.random() <= self.layer.get_effective_chance()
        logger.debug(f"Layer {self.layer.id} reset position, rolled chance: {self._should_play}")
        
    def get_next_chunk(self, chunk_size: int, current_time_ms: float) -> np.ndarray:
        """Get the next chunk of audio data.
        
        Args:
            chunk_size: Number of samples to return
            current_time_ms: Current stream time in milliseconds
            
        Returns:
            Numpy array of audio samples for this chunk
        """
        try:
            chunk = np.zeros((chunk_size, self.CHANNELS), dtype=np.int16)
            samples_remaining = chunk_size
            chunk_offset = 0
            
            while samples_remaining > 0:
                # Check if we've reached the loop point
                if self._position + samples_remaining > self.loop_length_samples:
                    # Handle the loop point
                    samples_until_loop = self.loop_length_samples - self._position
                    
                    # Get samples until the loop point if we should play
                    if samples_until_loop > 0 and self._should_play:
                        # If we still have audio data, use it
                        if self._audio_position < self.audio_length_samples:
                            audio_samples = min(samples_until_loop, 
                                             self.audio_length_samples - self._audio_position)
                            
                            # Get the samples from audio data
                            chunk[chunk_offset:chunk_offset + audio_samples] = \
                                self.audio_data[self._audio_position:self._audio_position + audio_samples]
                            
                            # Update positions
                            self._audio_position += audio_samples
                            chunk_offset += audio_samples
                        
                        # Always increment position by samples_until_loop, even if we ran out of audio
                        self._position += samples_until_loop
                    else:
                        # If not playing, just update position
                        self._position += samples_until_loop
                    
                    # Reset positions at loop point
                    self._position = 0
                    self._audio_position = 0  # Reset audio position only at loop points
                    samples_remaining -= samples_until_loop
                    
                    # Update the active sound index at the loop point
                    self.update_active_sound_index()
                    # Roll chance at the loop point
                    self._should_play = random.random() <= self.layer.get_effective_chance()
                    logger.debug(f"Layer {self.layer.id} completed cycle, rolled new chance: {self._should_play}")
                else:
                    # Normal playback - determine how many samples to process in this iteration
                    samples_this_iteration = min(samples_remaining, 
                                              self.loop_length_samples - self._position)
                    
                    # If we should play and still have audio data, use it
                    if self._should_play and self._audio_position < self.audio_length_samples:
                        audio_samples = min(samples_this_iteration,
                                         self.audio_length_samples - self._audio_position)
                        
                        # Get the samples from audio data
                        chunk[chunk_offset:chunk_offset + audio_samples] = \
                            self.audio_data[self._audio_position:self._audio_position + audio_samples]
                        
                        # Update audio position
                        self._audio_position += audio_samples
                        chunk_offset += audio_samples
                    
                    # Always increment position by the full amount
                    self._position += samples_this_iteration
                    samples_remaining -= samples_this_iteration
            
            # Apply volume if we're playing
            if self._should_play:
                current_volume = self.volume
                if current_volume != 1.0:
                    chunk = (chunk.astype(np.float32) * current_volume).astype(np.int16)
            
            return chunk
            
        except Exception as e:
            logger.error(f"Error getting next chunk: {e}", exc_info=True)
            return np.zeros((chunk_size, self.CHANNELS), dtype=np.int16)  # Return silence on error 