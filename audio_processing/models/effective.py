from dataclasses import dataclass
from typing import List, Optional, Dict
from .audio import Layer, LayerSound, Effects, LayerMode
from .presets import Preset, PresetLayer, PresetSound

@dataclass
class EffectiveLayerSound:
    """Contains the effective values for a layer sound after preset application"""
    id: str
    file_id: str
    frequency: float
    volume: float

    @classmethod
    def from_layer_sound(cls, sound: LayerSound, preset_sound: Optional[PresetSound] = None) -> 'EffectiveLayerSound':
        """Create effective layer sound from base sound and optional preset override"""
        if not preset_sound:
            return cls(
                id=sound.id,
                file_id=sound.file_id,
                frequency=sound.frequency,
                volume=sound.volume
            )
            
        return cls(
            id=sound.id,
            file_id=preset_sound.file_id or sound.file_id,
            frequency=preset_sound.frequency if preset_sound.frequency is not None else sound.frequency,
            volume=preset_sound.volume if preset_sound.volume is not None else sound.volume
        )

@dataclass
class EffectiveLayer:
    """Contains the effective values for a layer after preset application"""
    id: str
    name: str
    sounds: List[EffectiveLayerSound]
    chance: float
    cooldown_cycles: Optional[int]
    loop_length_ms: Optional[int]
    weight: float
    volume: float
    mode: LayerMode

    @classmethod
    def from_layer(cls, layer: Layer, preset_layer: Optional[PresetLayer] = None) -> 'EffectiveLayer':
        """Create effective layer from base layer and optional preset override"""
        if not preset_layer:
            return cls(
                id=layer.id,
                name=layer.name,
                sounds=[EffectiveLayerSound.from_layer_sound(s) for s in layer.sounds],
                chance=layer.chance,
                cooldown_cycles=layer.cooldown_cycles,
                loop_length_ms=layer.loop_length_ms,
                weight=layer.weight,
                volume=layer.volume,
                mode=layer.mode
            )

        # Create a map of preset sounds by ID for quick lookup
        preset_sounds = {
            ps.id: ps for ps in (preset_layer.sounds or [])
        }

        return cls(
            id=layer.id,
            name=layer.name,
            sounds=[
                EffectiveLayerSound.from_layer_sound(
                    sound, 
                    preset_sounds.get(sound.id)
                ) for sound in layer.sounds
            ],
            chance=preset_layer.chance if preset_layer.chance is not None else layer.chance,
            cooldown_cycles=preset_layer.cooldown_cycles if preset_layer.cooldown_cycles is not None else layer.cooldown_cycles,
            loop_length_ms=layer.loop_length_ms,  # Assuming loop_length_ms isn't preset-overridable
            weight=preset_layer.weight if preset_layer.weight is not None else layer.weight,
            volume=preset_layer.volume if preset_layer.volume is not None else layer.volume,
            mode=preset_layer.mode if preset_layer.mode is not None else layer.mode
        )

@dataclass
class EffectiveEnvironment:
    """Contains the effective values for an environment after preset application"""
    id: str
    name: str
    max_weight: float
    layers: List[EffectiveLayer]
    effects: Optional[Effects]
    soundboard: List[str]

    def get_layer(self, layer_id: str) -> Optional[EffectiveLayer]:
        """Get a layer by ID"""
        return next((l for l in self.layers if l.id == layer_id), None)

    def get_sound(self, layer_id: str, sound_id: str) -> Optional[EffectiveLayerSound]:
        """Get a sound by layer ID and sound ID"""
        layer = self.get_layer(layer_id)
        if not layer:
            return None
        return next((s for s in layer.sounds if s.id == sound_id), None)

    def validate(self) -> List[str]:
        """Validate the effective environment configuration
        
        Returns:
            List of error messages, empty if valid
        """
        errors = []
        
        # Check max_weight is positive
        if self.max_weight <= 0:
            errors.append(f"Max weight must be positive, got {self.max_weight}")
            
        # Validate layers
        total_weight = 0
        for layer in self.layers:
            # Check layer weight
            if layer.weight < 0:
                errors.append(f"Layer {layer.name} has negative weight: {layer.weight}")
            total_weight += layer.weight
            
            # Check layer volume
            if not 0 <= layer.volume <= 1:
                errors.append(f"Layer {layer.name} volume must be between 0 and 1, got {layer.volume}")
                
            # Check layer chance
            if not 0 <= layer.chance <= 1:
                errors.append(f"Layer {layer.name} chance must be between 0 and 1, got {layer.chance}")
                
            # Check layer has sounds
            if not layer.sounds:
                errors.append(f"Layer {layer.name} has no sounds")
                
            # Validate sounds
            for sound in layer.sounds:
                if not 0 <= sound.volume <= 1:
                    errors.append(f"Sound {sound.id} in layer {layer.name} has invalid volume: {sound.volume}")
                if sound.frequency <= 0:
                    errors.append(f"Sound {sound.id} in layer {layer.name} has invalid frequency: {sound.frequency}")
                    
        # Check total weight against max_weight
        if total_weight > self.max_weight:
            errors.append(f"Total layer weight ({total_weight}) exceeds max weight ({self.max_weight})")
            
        return errors 