from dataclasses import dataclass
from typing import List, Optional, Dict
from enum import Enum
import uuid

class LayerMode(str, Enum):
    """Represents the playback mode of a layer"""
    SHUFFLE = 'SHUFFLE'
    SEQUENCE = 'SEQUENCE'
    SINGLE = 'SINGLE'

class PlayState(str, Enum):
    """Represents the playback state of the application"""
    PLAYING = 'PLAYING'
    STOPPED = 'STOPPED'
    LOADING = 'LOADING'

@dataclass
class SoundFile:
    """Represents a sound file in the system"""
    id: str
    name: str
    path: str
    peak_volume: float
    duration_ms: int
    original_filename: Optional[str] = None
    usage_count: int = 0

    @classmethod
    def from_dict(cls, data: Dict) -> 'SoundFile':
        return cls(
            id=data['id'],
            name=data['name'],
            path=data['path'],
            peak_volume=float(data['peak_volume']),
            duration_ms=int(data['duration_ms']),
            original_filename=data.get('original_filename'),
            usage_count=int(data.get('usageCount', 0))
        )

@dataclass
class LayerSound:
    """Represents a sound within a layer, with layer-specific settings"""
    id: str
    file_id: str  # Reference to a SoundFile
    frequency: float  # Frequency of selection within the layer
    volume: float  # Sound-specific volume adjustment

    @classmethod
    def from_dict(cls, data: Dict) -> 'LayerSound':
        return cls(
            id=data['id'],
            file_id=data['fileId'],
            frequency=float(data['frequency']),
            volume=float(data['volume'])
        )

@dataclass
class Effects:
    """Represents the audio effects configuration"""
    class Normalize:
        enabled: bool = False

    class Fades:
        fade_in_duration: int = 0
        crossfade_duration: int = 0

    class Filters:
        class HighPass:
            frequency: float = 0.0

        class LowPass:
            frequency: float = 20000.0

        class DampenSpeechRange:
            amount: float = 0.0

        high_pass: HighPass = HighPass()
        low_pass: LowPass = LowPass()
        dampen_speech_range: DampenSpeechRange = DampenSpeechRange()

    class Compressor:
        low_threshold: float = -60.0
        high_threshold: float = -12.0
        ratio: float = 2.0

    normalize: Normalize = Normalize()
    fades: Fades = Fades()
    filters: Filters = Filters()
    compressor: Compressor = Compressor()

    @classmethod
    def from_dict(cls, data: Dict) -> 'Effects':
        effects = cls()
        if not data:
            return effects

        if 'normalize' in data:
            effects.normalize.enabled = data['normalize']['enabled']

        if 'fades' in data:
            effects.fades.fade_in_duration = data['fades']['fadeInDuration']
            effects.fades.crossfade_duration = data['fades']['crossfadeDuration']

        if 'filters' in data:
            filters = data['filters']
            if 'highPass' in filters:
                effects.filters.high_pass.frequency = filters['highPass']['frequency']
            if 'lowPass' in filters:
                effects.filters.low_pass.frequency = filters['lowPass']['frequency']
            if 'dampenSpeechRange' in filters:
                effects.filters.dampen_speech_range.amount = filters['dampenSpeechRange']['amount']

        if 'compressor' in data:
            comp = data['compressor']
            effects.compressor.low_threshold = comp['lowThreshold']
            effects.compressor.high_threshold = comp['highThreshold']
            effects.compressor.ratio = comp['ratio']

        return effects

@dataclass
class Layer:
    """Represents a layer in an environment"""
    id: str
    name: str
    sounds: List[LayerSound]
    chance: float  # Probability of playing (0-1)
    cooldown_cycles: Optional[int] = None
    loop_length_ms: Optional[int] = None
    weight: float = 1.0  # How much this layer contributes to the total environment weight
    volume: float = 1.0  # Layer-level volume multiplier (0-1)
    mode: LayerMode = LayerMode.SHUFFLE

    @classmethod
    def from_dict(cls, data: Dict) -> 'Layer':
        return cls(
            id=data['id'],
            name=data['name'],
            sounds=[LayerSound.from_dict(s) for s in data['sounds']],
            chance=float(data['chance']),
            cooldown_cycles=data.get('cooldownCycles'),
            loop_length_ms=data.get('loopLengthMs'),
            weight=float(data['weight']),
            volume=float(data['volume']),
            mode=LayerMode(data['mode'])
        )

@dataclass
class Environment:
    """Represents a complete audio environment"""
    id: str
    name: str
    max_weight: float
    layers: List[Layer]
    presets: List['Preset']  # Forward reference since Preset isn't defined yet
    background_image: Optional[str] = None
    soundboard: List[str] = None  # List of sound IDs for quick playback
    active_preset_id: Optional[str] = None
    effects: Optional[Effects] = None

    def __post_init__(self):
        if self.soundboard is None:
            self.soundboard = []

    @classmethod
    def from_dict(cls, data: Dict) -> 'Environment':
        from .presets import Preset  # Import here to avoid circular dependency
        return cls(
            id=data['id'],
            name=data['name'],
            max_weight=float(data['maxWeight']),
            layers=[Layer.from_dict(l) for l in data['layers']],
            presets=[Preset.from_dict(p) for p in data.get('presets', [])],
            background_image=data.get('backgroundImage'),
            soundboard=data.get('soundboard', []),
            active_preset_id=data.get('activePresetId'),
            effects=Effects.from_dict(data.get('effects', {}))
        )

@dataclass
class ActiveEnvironment:
    """Represents the active environment and its state"""
    environment: Environment
    active_layer_ids: List[str]
    active_preset_id: Optional[str] = None
    current_weight: float = 0.0

    @classmethod
    def from_dict(cls, data: Dict) -> 'ActiveEnvironment':
        return cls(
            environment=Environment.from_dict(data['environment']),
            active_layer_ids=data['activeLayerIds'],
            active_preset_id=data.get('activePresetId'),
            current_weight=float(data['currentWeight'])
        )

@dataclass
class AppState:
    """Represents the complete application state"""
    environments: List[Environment]
    master_volume: float  # Global volume multiplier (0-1)
    soundboard: List[str]  # Global sound IDs available in all environments
    play_state: PlayState
    active_environment: Optional[ActiveEnvironment] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'AppState':
        return cls(
            environments=[Environment.from_dict(e) for e in data['environments']],
            master_volume=float(data['masterVolume']),
            soundboard=data['soundboard'],
            play_state=PlayState(data['playState']),
            active_environment=ActiveEnvironment.from_dict(data['activeEnvironment']) 
                if data.get('activeEnvironment') else None
        )

    def to_dict(self) -> Dict:
        """Convert the AppState to a dictionary"""
        return {
            'environments': [env.__dict__ for env in self.environments],
            'masterVolume': self.master_volume,
            'soundboard': self.soundboard,
            'playState': self.play_state.value,
            'activeEnvironment': self.active_environment.__dict__ if self.active_environment else None
        } 