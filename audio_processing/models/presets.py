from dataclasses import dataclass
from typing import List, Optional, Dict
from .audio import LayerMode
import logging
import json

logger = logging.getLogger(__name__)

@dataclass
class PresetSound:
    """Represents a sound override in a preset"""
    id: str        # Must match the original sound ID
    file_id: str   # Must match the original sound's fileId
    volume: Optional[float] = None
    frequency: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'PresetSound':
        try:
            return cls(
                id=data['id'],
                file_id=data['fileId'],
                volume=float(data['volume']) if 'volume' in data and data['volume'] is not None else None,
                frequency=float(data['frequency']) if 'frequency' in data and data['frequency'] is not None else None
            )
        except Exception as e:
            logger.error(f"Error creating PresetSound from dict: {e}")
            # Return a minimal valid sound with just the ID and file_id
            return cls(
                id=data.get('id', 'error'),
                file_id=data.get('fileId', 'error')
            )

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'fileId': self.file_id,
            'volume': self.volume,
            'frequency': self.frequency
        }

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
    _environment: Optional['Environment'] = None
    _base_layer: Optional['Layer'] = None  # Reference to the base layer this preset overrides

    def set_environment(self, environment: 'Environment') -> None:
        """Set the environment reference for this preset layer"""
        logger.debug(f"Setting environment {environment.id} on preset layer {self.id}")
        self._environment = environment
        # Find and store reference to base layer
        self._base_layer = next((l for l in environment.layers if l.id == self.id), None)
        if self._base_layer:
            logger.debug(f"Found base layer {self._base_layer.id} for preset layer {self.id}")
        else:
            logger.warning(f"No base layer found for preset layer {self.id}")

    @classmethod
    def from_dict(cls, data: Dict) -> 'PresetLayer':
        try:
            logger.debug(f"Creating PresetLayer from data: {json.dumps(data, indent=2)}")
            preset_layer = cls(
                id=data['id'],
                volume=float(data['volume']) if 'volume' in data and data['volume'] is not None else None,
                weight=float(data['weight']) if 'weight' in data and data['weight'] is not None else None,
                chance=float(data['chance']) if 'chance' in data and data['chance'] is not None else None,
                cooldown_cycles=int(data['cooldownCycles']) if 'cooldownCycles' in data and data['cooldownCycles'] is not None else None,
                mode=LayerMode(data['mode']) if 'mode' in data and data['mode'] is not None else None,
                sounds=[PresetSound.from_dict(s) for s in data.get('sounds', [])] if data.get('sounds') else None
            )
            logger.debug(f"Created PresetLayer {preset_layer.id}")
            return preset_layer
        except Exception as e:
            logger.error(f"Error creating PresetLayer from dict: {e}")
            # Return a minimal valid layer with just the ID
            return cls(id=data.get('id', 'error'))

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'volume': self.volume,
            'weight': self.weight,
            'chance': self.chance,
            'cooldownCycles': self.cooldown_cycles,
            'mode': self.mode.value if self.mode else None,
            'sounds': [s.to_dict() for s in self.sounds] if self.sounds else None
        }

@dataclass
class Preset:
    """Represents a preset configuration for an environment"""
    id: str
    name: str
    max_weight: Optional[float] = None
    layers: List[PresetLayer] = None
    is_default: bool = False

    # Runtime-only fields (not serialized)
    _environment: Optional['Environment'] = None

    def __post_init__(self):
        if self.layers is None:
            self.layers = []

    def set_environment(self, environment: 'Environment') -> None:
        """Set the environment reference for this preset and all its layers"""
        logger.debug(f"Setting environment {environment.id} on preset {self.id}")
        self._environment = environment
        for layer in self.layers:
            layer.set_environment(environment)
            # Also set environment on the corresponding base layer
            base_layer = next((l for l in environment.layers if l.id == layer.id), None)
            if base_layer:
                logger.debug(f"Setting environment on base layer {base_layer.id} from preset {self.id}")
                base_layer.set_environment(environment)
            else:
                logger.warning(f"No base layer found for preset layer {layer.id} in preset {self.id}")

    @classmethod
    def from_dict(cls, data: Dict) -> 'Preset':
        try:
            logger.debug(f"Creating Preset from data: {json.dumps(data, indent=2)}")
            
            # Extract and validate required fields
            if 'id' not in data:
                raise ValueError("Missing required field: id")
            if 'name' not in data:
                raise ValueError("Missing required field: name")
            
            # Process layers
            layers = []
            if 'layers' in data:
                logger.debug(f"Processing {len(data['layers'])} preset layers")
                for layer_data in data['layers']:
                    try:
                        layer = PresetLayer.from_dict(layer_data)
                        layers.append(layer)
                        logger.debug(f"Added preset layer: {layer.id}")
                    except Exception as e:
                        logger.error(f"Error creating preset layer: {e}", exc_info=True)
            
            # Handle maxWeight - only convert to float if it exists and is not None
            max_weight = None
            if 'maxWeight' in data and data['maxWeight'] is not None:
                try:
                    max_weight = float(data['maxWeight'])
                except (TypeError, ValueError) as e:
                    logger.error(f"Invalid maxWeight value: {data['maxWeight']}")
                    max_weight = None
            
            # Create preset
            preset = cls(
                id=data['id'],
                name=data['name'],
                max_weight=max_weight,
                layers=layers,
                is_default=bool(data.get('isDefault', False))
            )
            
            logger.debug(f"Created preset {preset.id} - {preset.name} with {len(preset.layers)} layers")
            return preset
            
        except Exception as e:
            logger.error(f"Error creating preset: {e}", exc_info=True)
            raise

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'maxWeight': self.max_weight,
            'layers': [l.to_dict() for l in self.layers],
            'isDefault': self.is_default
        } 