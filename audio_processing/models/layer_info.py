import logging
import random
import numpy as np
from typing import Dict, Any, Optional, List
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
        self._layer = None  # Initialize as None
        self.layer = layer  # Use the setter
        self._position = 0  # Position within the loop
        self._audio_position = 0  # Position within the audio data
        # Initialize active_sound_index to the selected sound index
        self._active_sound_index = layer.selected_sound_index
        # Initialize chance roll
        self._chance_roll = random.random()  # Store the roll value
        # Initialize cooldown state
        self._cooldown_cycles_elapsed = 0  # Number of cycles since last play
    
    @property
    def layer(self) -> Layer:
        """Get the layer."""
        return self._layer
        
    @layer.setter
    def layer(self, value: Layer):
        """Set the layer, ensuring we use the same environment reference."""
        if self._layer is value:
            return
            
        # If we already have a layer and it's from the same environment,
        # use the layer from that environment to ensure we share the same reference
        if self._layer and self._layer._environment and value._environment:
            if self._layer._environment is not value._environment:
                # Find the layer in the current environment
                existing_layer = next(
                    (l for l in value._environment.layers if l.id == value.id),
                    None
                )
                if existing_layer:
                    self._layer = existing_layer
                    return
                    
        self._layer = value
    
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
            
        return sound.get_effective_volume_including_fade()
        
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
        # Reset cooldown state
        self._cooldown_cycles_elapsed = 0
        # Don't check weights here, just reset state
        self._will_play_next = False
        self._checked_for_next = False

    def check_and_prepare_next_cycle(self, current_weight: float = 0) -> bool:
        """Check if this layer should play in the next cycle."""
        if not self._check_chance_and_cooldown():
            self._will_play_next = False
            self._checked_for_next = True
            return False
            
        if not self._check_weight_limits(current_weight):
            self._will_play_next = False
            self._checked_for_next = True
            return False
            
        self._will_play_next = True
        self._checked_for_next = True
        return True

    def get_next_chunk(self, chunk_size: int, current_time_ms: float) -> Optional[np.ndarray]:
        """Get the next chunk of audio data.
        
        Args:
            chunk_size: Number of samples to return
            current_time_ms: Current stream time in milliseconds
            
        Returns:
            Numpy array of audio samples for this chunk, or None if the sound is finished
        """
        try:
            # For soundboard sounds, check if we've reached the end of the audio
            if self.layer.id.startswith("soundboard_"):
                if self._audio_position >= self.audio_length_samples:
                    self._is_finished = True
                    return None
                
                # Get as many samples as we can
                samples_to_get = min(chunk_size, self.audio_length_samples - self._audio_position)
                chunk = np.zeros((chunk_size, self.CHANNELS), dtype=np.int16)
                chunk[:samples_to_get] = self.audio_data[self._audio_position:self._audio_position + samples_to_get]
                self._audio_position += samples_to_get
                return chunk
            
            chunk = np.zeros((chunk_size, self.CHANNELS), dtype=np.int16)
            samples_remaining = chunk_size
            chunk_offset = 0
            
            while samples_remaining > 0:
                # Check if we've reached the loop point
                if self._position >= self.loop_length_samples:
                    # Reset positions at loop point
                    self._position = 0
                    self._audio_position = 0
                    
                    # Update the active sound index at the loop point
                    self.update_active_sound_index()
                    
                    # First phase: Check all layers in environment
                    if self.layer._environment:
                        # Get all LayerInfo instances for this environment's layers
                        env_layers = []
                        for layer in self.layer._environment.layers:
                            if not layer.sounds:
                                continue
                            # Find the LayerInfo for the current sound
                            current_sound = layer.sounds[layer.selected_sound_index]
                            cache_key = f"{layer.id}_{current_sound.file_id}"
                            # Look in the mixer's cache for the LayerInfo
                            from audio_processing.models.mixer import mixer
                            if cache_key in mixer._cached_layers:
                                env_layers.append(mixer._cached_layers[cache_key])
                
                # Get samples for this chunk
                samples_to_get = min(samples_remaining, self.loop_length_samples - self._position)
                
                # Always copy audio data if we have it
                if self._audio_position < self.audio_length_samples:
                    # Get as many samples as we can from current audio position
                    audio_samples = min(samples_to_get, self.audio_length_samples - self._audio_position)
                    
                    # Get the samples from audio data
                    chunk[chunk_offset:chunk_offset + audio_samples] = \
                        self.audio_data[self._audio_position:self._audio_position + audio_samples]
                    
                    # Update audio position
                    self._audio_position += audio_samples
                    chunk_offset += audio_samples
                else:
                    # Reset audio position if we've reached the end
                    self._audio_position = 0
                
                # Always update position
                self._position += samples_to_get
                samples_remaining -= samples_to_get
            
            # Apply volume if needed
            current_volume = self.volume
            if current_volume != 1.0:
                chunk = (chunk.astype(np.float32) * current_volume).astype(np.int16)
            
            return chunk
            
        except Exception as e:
            logger.error(f"Error getting next chunk: {e}", exc_info=True)
            return np.zeros((chunk_size, self.CHANNELS), dtype=np.int16)  # Return silence on error 