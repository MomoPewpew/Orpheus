from dataclasses import dataclass
from typing import List, Optional, Dict
from .audio import LayerMode
import logging

logger = logging.getLogger(__name__)


@dataclass
class PresetSound:
    """Represents a sound override in a preset"""
    id: str  # Must match the original sound ID
    volume: Optional[float] = None
    frequency: Optional[float] = None
    file_id: Optional[str] = None  # Only used internally, not serialized

    @classmethod
    def from_dict(cls, data: Dict) -> 'PresetSound':
        try:
            return cls(
                id=data['id'],
                volume=float(data['volume']) if 'volume' in data and data['volume'] is not None else None,
                frequency=float(data['frequency']) if 'frequency' in data and data['frequency'] is not None else None
            )
        except Exception as e:
            logger.error(f"Error creating PresetSound from dict: {e}")
            # Return a minimal valid sound with just the ID
            return cls(id=data.get('id', 'error'))

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        result = {'id': self.id}

        # Only include fields that have values
        if self.volume is not None:
            result['volume'] = self.volume
        if self.frequency is not None:
            result['frequency'] = self.frequency

        return result


@dataclass
class PresetLayer:
    """Represents a layer override in a preset"""
    id: str
    volume: Optional[float] = None
    weight: Optional[float] = None
    chance: Optional[float] = None
    cooldown_cycles: Optional[int] = None
    mode: Optional[LayerMode] = None
    sounds: Optional[List[PresetSound]] = None

    # Runtime-only fields (not serialized)
    environment: Optional['Environment'] = None
    base_layer: Optional['Layer'] = None  # Reference to the base layer this preset overrides

    def setenvironment(self, environment: 'Environment') -> None:
        """Set the environment reference for this preset layer"""
        self.environment = environment
        # Find and store reference to base layer
        self.base_layer = next((layer_ for layer_ in environment.layers if layer_.id == self.id), None)
        if not self.base_layer:
            logger.warning(f"No base layer found for preset layer {self.id}")

    @classmethod
    def from_dict(cls, data: Dict) -> 'PresetLayer':
        try:
            preset_layer = cls(
                id=data['id'],
                volume=float(data['volume']) if 'volume' in data and data['volume'] is not None else None,
                weight=float(data['weight']) if 'weight' in data and data['weight'] is not None else None,
                chance=float(data['chance']) if 'chance' in data and data['chance'] is not None else None,
                cooldown_cycles=int(data['cooldownCycles']) if 'cooldownCycles' in data and data[
                    'cooldownCycles'] is not None else None,
                mode=LayerMode(data['mode']) if 'mode' in data and data['mode'] is not None else None,
                sounds=[PresetSound.from_dict(s) for s in data.get('sounds', [])] if data.get('sounds') else None
            )
            return preset_layer
        except Exception as e:
            logger.error(f"Error creating PresetLayer from dict: {e}")
            # Return a minimal valid layer with just the ID
            return cls(id=data.get('id', 'error'))

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        result = {'id': self.id}

        # Only include fields that have values
        if self.volume is not None:
            result['volume'] = self.volume
        if self.weight is not None:
            result['weight'] = self.weight
        if self.chance is not None:
            result['chance'] = self.chance
        if self.cooldown_cycles is not None:
            result['cooldownCycles'] = self.cooldown_cycles
        if self.sounds:
            result['sounds'] = [s.to_dict() for s in self.sounds]

        return result


@dataclass
class Preset:
    """Represents a preset configuration for an environment"""
    id: str
    name: str
    max_weight: Optional[float] = None
    layers: List[PresetLayer] = None

    # Runtime-only fields (not serialized)
    environment: Optional['Environment'] = None

    def __post_init__(self):
        if self.layers is None:
            self.layers = []

    def setenvironment(self, environment: 'Environment') -> None:
        """Set the environment reference for this preset and all its layers"""
        self.environment = environment
        for layer in self.layers:
            layer.setenvironment(environment)
            # Also set environment on the corresponding base layer
            base_layer = next((layer_ for layer_ in environment.layers if layer_.id == layer.id), None)
            if base_layer:
                base_layer.setenvironment(environment)
            else:
                logger.warning(f"No base layer found for preset layer {layer.id} in preset {self.id}")

    @classmethod
    def from_dict(cls, data: Dict) -> 'Preset':
        try:
            # Extract and validate required fields
            if 'id' not in data:
                raise ValueError("Missing required field: id")
            if 'name' not in data:
                raise ValueError("Missing required field: name")

            # Process layers
            layers = []
            if 'layers' in data:
                for layer_data in data['layers']:
                    try:
                        layer = PresetLayer.from_dict(layer_data)
                        layers.append(layer)
                    except Exception as e:
                        logger.error(f"Error creating preset layer: {e}", exc_info=True)

            # Handle maxWeight - only convert to float if it exists and is not None
            max_weight = None
            if 'maxWeight' in data and data['maxWeight'] is not None:
                try:
                    max_weight = float(data['maxWeight'])
                except (TypeError, ValueError) as _:
                    logger.error(f"Invalid maxWeight value: {data['maxWeight']}")
                    max_weight = None

            # Create preset
            preset = cls(
                id=data['id'],
                name=data['name'],
                max_weight=max_weight,
                layers=layers
            )

            return preset

        except Exception as e:
            logger.error(f"Error creating preset: {e}", exc_info=True)
            raise

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        # Filter out layers that only have an ID
        layers_with_overrides = [layer_.to_dict() for layer_ in self.layers]
        layers_with_overrides = [layer_ for layer_ in layers_with_overrides if len(layer_) > 1]  # More than just 'id'

        result = {
            'id': self.id,
            'name': self.name
        }

        if layers_with_overrides:
            result['layers'] = layers_with_overrides

        if self.max_weight is not None:
            result['maxWeight'] = self.max_weight

        return result
