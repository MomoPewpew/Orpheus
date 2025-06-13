import logging
import numpy as np
from typing import Dict, Any

logger = logging.getLogger(__name__)

class LayerInfo:
    """Represents a single audio layer in the streaming mix."""
    
    # Audio configuration
    SAMPLE_RATE = 48000  # Hz
    CHANNELS = 2
    
    def __init__(self, audio_data: np.ndarray, layer_data: Dict[str, Any]):
        """Initialize a new audio layer.
        
        Args:
            audio_data: Numpy array of audio samples (shape: [samples, channels])
            layer_data: Reference to the layer configuration object from the workspace
        """
        # Convert float32 [-1.0, 1.0] to int16 PCM
        self.audio_data = (audio_data * 32767).astype(np.int16)
        self.audio_length_samples = len(self.audio_data)
        self.layer_data = layer_data
        self._position = 0  # Position within the loop
        self._audio_position = 0  # Position within the audio data
        logger.debug(f"Initialized layer with audio length: {self.audio_length_samples} samples")
    
    @property
    def loop_length_samples(self) -> int:
        """Get the current loop length in samples, based on layer configuration."""
        loop_length_ms = self.layer_data.get('loopLengthMs', 8000)  # Default 8 seconds
        return int(self.SAMPLE_RATE * (loop_length_ms / 1000))
    
    @property
    def volume(self) -> float:
        """Get the current volume, based on layer and sound configuration."""
        layer_volume = self.layer_data.get('volume', 1.0)
        # Assuming first sound in the layer for now
        sounds = self.layer_data.get('sounds', [])
        sound_volume = sounds[0].get('volume', 1.0) if sounds else 1.0
        return layer_volume * sound_volume
        
    def reset_position(self):
        """Reset the playback position to the start of the audio."""
        self._position = 0
        self._audio_position = 0
        logger.debug("Reset layer position to start")
        
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
                    
                    # Get samples until the loop point
                    if samples_until_loop > 0:
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
                    
                    # Reset positions at loop point
                    self._position = 0
                    self._audio_position = 0  # Reset audio position only at loop points
                    samples_remaining -= samples_until_loop
                    logger.debug(f"Loop point reached, reset positions. Remaining samples: {samples_remaining}")
                else:
                    # Normal playback - determine how many samples to process in this iteration
                    samples_this_iteration = min(samples_remaining, 
                                              self.loop_length_samples - self._position)
                    
                    # If we still have audio data, use it
                    if self._audio_position < self.audio_length_samples:
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
            
            # Apply volume
            current_volume = self.volume
            if current_volume != 1.0:
                chunk = (chunk.astype(np.float32) * current_volume).astype(np.int16)
            
            return chunk
            
        except Exception as e:
            logger.error(f"Error getting next chunk: {e}", exc_info=True)
            return np.zeros((chunk_size, self.CHANNELS), dtype=np.int16)  # Return silence on error 