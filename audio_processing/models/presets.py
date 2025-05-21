from dataclasses import dataclass
from typing import List, Optional, Dict
from .audio import LayerMode

@dataclass
class PresetSound:
    """Represents a sound override in a preset"""
    id: str        # Must match the original sound ID
    file_id: str   # Must match the original sound's fileId
    volume: Optional[float] = None
    frequency: Optional[float] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'PresetSound':
        return cls(
            id=data['id'],
            file_id=data['fileId'],
            volume=float(data['volume']) if 'volume' in data else None,
            frequency=float(data['frequency']) if 'frequency' in data else None
        )

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

    @classmethod
    def from_dict(cls, data: Dict) -> 'PresetLayer':
        return cls(
            id=data['id'],
            volume=float(data['volume']) if 'volume' in data else None,
            weight=float(data['weight']) if 'weight' in data else None,
            chance=float(data['chance']) if 'chance' in data else None,
            cooldown_cycles=int(data['cooldownCycles']) if 'cooldownCycles' in data else None,
            mode=LayerMode(data['mode']) if 'mode' in data else None,
            sounds=[PresetSound.from_dict(s) for s in data['sounds']] if 'sounds' in data else None
        )

@dataclass
class Preset:
    """Represents a preset configuration for an environment"""
    id: str
    name: str
    max_weight: Optional[float] = None
    layers: List[PresetLayer] = None
    is_default: bool = False

    def __post_init__(self):
        if self.layers is None:
            self.layers = []

    @classmethod
    def from_dict(cls, data: Dict) -> 'Preset':
        return cls(
            id=data['id'],
            name=data['name'],
            max_weight=float(data['maxWeight']) if 'maxWeight' in data else None,
            layers=[PresetLayer.from_dict(l) for l in data['layers']],
            is_default=bool(data.get('isDefault', False))
        ) 