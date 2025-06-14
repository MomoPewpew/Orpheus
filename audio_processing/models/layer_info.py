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
        # Initialize chance state - don't roll yet, wait for first cycle
        self._should_play = False
        self._will_play_next = False  # Track if approved for next cycle
        self._checked_for_next = False  # Track if we've been checked for next cycle
        # Initialize cooldown state
        self._cooldown_cycles_elapsed = 0  # Number of cycles since last play
        self._in_cooldown = False  # Whether we're in a cooldown period
    
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
        # Reset cooldown state
        self._cooldown_cycles_elapsed = 0
        self._in_cooldown = False
        # Don't check weights here, just reset state
        self._should_play = False
        self._will_play_next = False
        self._checked_for_next = False
        logger.debug(f"Layer {self.layer.id} reset position, cooldown elapsed: {self._cooldown_cycles_elapsed}, in cooldown: {self._in_cooldown}")

    @staticmethod
    def check_initial_weights(layers: List['LayerInfo']) -> None:
        """Check initial weights for a list of layers.
        
        Args:
            layers: List of LayerInfo instances to check
        """
        logger.debug(f"Starting initial weight checks for {len(layers)} layers")
        
        # Reset checked state for all layers
        for layer_info in layers:
            layer_info._checked_for_next = False
            layer_info._will_play_next = False
            logger.debug(f"Reset state for layer {layer_info.layer.id}")
        
        # Check all layers in sequence, accumulating weight
        current_weight = 0
        for layer_info in layers:
            logger.debug(f"Checking layer {layer_info.layer.id} with current weight {current_weight}")
            if layer_info.check_and_prepare_next_cycle(current_weight):
                current_weight += layer_info.layer.get_effective_weight()
                logger.debug(f"Layer {layer_info.layer.id} passed checks, new weight: {current_weight}")
                
        # Apply the decisions
        for layer_info in layers:
            layer_info._should_play = layer_info._will_play_next
            if not layer_info._should_play and layer_info._in_cooldown:
                logger.debug(f"Layer {layer_info.layer.id} in cooldown ({layer_info._cooldown_cycles_elapsed} cycles), forced not to play")
            elif layer_info._should_play:
                logger.debug(f"Layer {layer_info.layer.id} will play initially")
            else:
                logger.debug(f"Layer {layer_info.layer.id} will not play initially")

    def _check_chance_and_cooldown(self) -> bool:
        """Check if the layer should play based on chance and cooldown."""
        # First check cooldown
        if self._in_cooldown:
            logger.debug(f"Layer {self.layer.id} is in cooldown")
            return False
            
        # Check chance
        chance = self.layer.get_effective_chance()
        if chance is None:
            chance = 1.0  # Default to always play if no chance set
        if random.random() > chance:
            logger.debug(f"Layer {self.layer.id} failed chance roll ({chance})")
            return False
            
        logger.debug(f"Layer {self.layer.id} passed chance roll ({chance})")
        return True

    def _check_weight_limits(self, current_weight: float) -> bool:
        """Check if the layer can play based on weight limits."""
        env = self.layer._environment
        if not env:
            return True
            
        max_weight = env.get_effective_max_weight()
        layer_weight = self.layer.get_effective_weight()
        
        if current_weight + layer_weight > max_weight:
            logger.debug(f"Layer {self.layer.id} skipped due to weight limit (current: {current_weight}, max: {max_weight}, layer weight: {layer_weight})")
            return False
            
        logger.debug(f"Layer {self.layer.id} weight check passed (current: {current_weight}, max: {max_weight}, layer weight: {layer_weight})")
        return True

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
                    
                    # Handle cooldown cycles at the loop point
                    cooldown_cycles = self.layer.get_effective_cooldown_cycles()
                    if cooldown_cycles is None:
                        cooldown_cycles = 0  # Default to no cooldown if not set
                        
                    if self._should_play:
                        # If we played this cycle, start cooldown
                        self._in_cooldown = True
                        self._cooldown_cycles_elapsed = 0
                        logger.debug(f"Layer {self.layer.id} played, starting cooldown (need {cooldown_cycles} cycles)")
                    elif self._in_cooldown:
                        # If we're in cooldown, increment the counter
                        self._cooldown_cycles_elapsed += 1
                        # Check if we've completed the cooldown
                        if self._cooldown_cycles_elapsed >= cooldown_cycles:
                            self._in_cooldown = False
                            logger.debug(f"Layer {self.layer.id} cooldown complete after {self._cooldown_cycles_elapsed} cycles")
                        else:
                            logger.debug(f"Layer {self.layer.id} cooldown cycle {self._cooldown_cycles_elapsed} of {cooldown_cycles}")
                    
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
                        
                        # Check weights for this environment's layers
                        if env_layers:
                            logger.debug(f"Checking cycle-end weights for environment with {len(env_layers)} layers")
                            LayerInfo.check_initial_weights(env_layers)
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