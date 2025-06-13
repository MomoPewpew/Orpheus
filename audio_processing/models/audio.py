from dataclasses import dataclass, field
from typing import List, Optional, Dict
from enum import Enum
import uuid

class LayerMode(str, Enum):
    """Represents the playback mode of a layer"""
    SHUFFLE = 'SHUFFLE'
    SEQUENCE = 'SEQUENCE'
    SINGLE = 'SINGLE'

class PlayState(str, Enum):
    """Represents the playback state of an environment"""
    PLAYING = 'PLAYING'
    STOPPED = 'STOPPED'

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
    
    # Runtime-only fields (not serialized)
    _layer: Optional['Layer'] = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'LayerSound':
        return cls(
            id=data['id'],
            file_id=data['fileId'],
            frequency=float(data['frequency']),
            volume=float(data['volume'])
        )
        
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'fileId': self.file_id,
            'frequency': self.frequency,
            'volume': self.volume
        }
    
    def _get_preset_sound(self) -> Optional['PresetSound']:
        """Get the preset sound override for this sound, if any."""
        preset_layer = self._layer.get_active_preset_layer()
        if preset_layer and preset_layer.sounds:
            return next((ps for ps in preset_layer.sounds if ps.id == self.id), None)
        return None
    
    def get_effective_volume(self) -> float:
        """Get the effective volume for the sound, considering:
        1. Base sound volume or preset override
        2. Volume normalization (if enabled)
        3. Layer volume or preset override
        """
        # Get the base sound volume, potentially overridden by preset
        sound_volume = self.volume
        layer_volume = self._layer.volume
        
        # Apply preset overrides if any
        preset_layer = self._layer.get_active_preset_layer()
        if preset_layer:
            # Override layer volume if specified in preset
            if preset_layer.volume is not None:
                layer_volume = preset_layer.volume
                
            # Override sound volume if specified in preset
            preset_sound = self._get_preset_sound()
            if preset_sound and preset_sound.volume is not None:
                sound_volume = preset_sound.volume
        
        # Apply volume normalization if enabled
        if (self._layer._environment and 
            self._layer._environment._app_state and 
            self._layer._environment._app_state.effects.normalize.enabled):
            # Find the sound file to get its peak volume
            sound_file = next(
                (sf for sf in self._layer._environment._app_state.sound_files 
                 if sf.id == self.file_id), 
                None
            )
            if sound_file and sound_file.peak_volume > 0:
                # Normalize by applying the inverse of the peak volume
                # This makes all sounds peak at the same level
                sound_volume /= sound_file.peak_volume
        
        return layer_volume * sound_volume
    
    def get_effective_frequency(self) -> float:
        """Get the effective frequency for the sound, considering preset overrides."""
        # Start with base sound frequency
        sound_frequency = self.frequency
        
        # Override with preset value if specified
        preset_sound = self._get_preset_sound()
        if preset_sound and preset_sound.frequency is not None:
            sound_frequency = preset_sound.frequency

        return sound_frequency

@dataclass
class Effects:
    """Represents the audio effects configuration"""
    @dataclass
    class Normalize:
        enabled: bool = False
        
        def to_dict(self) -> Dict:
            return {
                "enabled": self.enabled
            }

    @dataclass
    class Fades:
        fade_in_duration: int = 0
        crossfade_duration: int = 0
        
        def to_dict(self) -> Dict:
            return {
                "fadeInDuration": self.fade_in_duration,
                "crossfadeDuration": self.crossfade_duration
            }

    @dataclass
    class Filters:
        @dataclass
        class HighPass:
            frequency: float = 0.0
            
            def to_dict(self) -> Dict:
                return {
                    "frequency": self.frequency
                }

        @dataclass
        class LowPass:
            frequency: float = 20000.0
            
            def to_dict(self) -> Dict:
                return {
                    "frequency": self.frequency
                }

        @dataclass
        class DampenSpeechRange:
            amount: float = 0.0
            
            def to_dict(self) -> Dict:
                return {
                    "amount": self.amount
                }

        high_pass: HighPass = field(default_factory=lambda: Effects.Filters.HighPass())
        low_pass: LowPass = field(default_factory=lambda: Effects.Filters.LowPass())
        dampen_speech_range: DampenSpeechRange = field(default_factory=lambda: Effects.Filters.DampenSpeechRange())
        
        def to_dict(self) -> Dict:
            return {
                "highPass": self.high_pass.to_dict(),
                "lowPass": self.low_pass.to_dict(),
                "dampenSpeechRange": self.dampen_speech_range.to_dict()
            }

    @dataclass
    class Compressor:
        low_threshold: float = -60.0
        high_threshold: float = -12.0
        ratio: float = 2.0
        
        def to_dict(self) -> Dict:
            return {
                "lowThreshold": self.low_threshold,
                "highThreshold": self.high_threshold,
                "ratio": self.ratio
            }

    normalize: Normalize = field(default_factory=lambda: Effects.Normalize())
    fades: Fades = field(default_factory=lambda: Effects.Fades())
    filters: Filters = field(default_factory=lambda: Effects.Filters())
    compressor: Compressor = field(default_factory=lambda: Effects.Compressor())

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

    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            "normalize": self.normalize.to_dict(),
            "fades": self.fades.to_dict(),
            "filters": self.filters.to_dict(),
            "compressor": self.compressor.to_dict()
        }

@dataclass
class Layer:
    """Represents a layer in an environment"""
    id: str
    name: str
    sounds: List[LayerSound]
    chance: float  # Probability of playing (0-1)
    cooldown_cycles: int = None
    loop_length_ms: int = None
    weight: float = 1.0  # How much this layer contributes to the total environment weight
    volume: float = 1.0  # Layer-level volume multiplier (0-1)
    mode: LayerMode = LayerMode.SHUFFLE
    selected_sound_index: int = 0  # Index of the currently selected sound in the sounds array
    
    # Runtime-only fields (not serialized)
    _environment: Optional['Environment'] = None

    def __post_init__(self):
        # Set layer reference on all sounds
        for sound in self.sounds:
            sound._layer = self

    @classmethod
    def from_dict(cls, data: Dict) -> 'Layer':
        layer = cls(
            id=data['id'],
            name=data['name'],
            sounds=[LayerSound.from_dict(s) for s in data['sounds']],
            chance=float(data['chance']),
            cooldown_cycles=data.get('cooldownCycles'),
            loop_length_ms=data.get('loopLengthMs'),
            weight=float(data['weight']),
            volume=float(data['volume']),
            mode=LayerMode(data['mode']),
            selected_sound_index=int(data.get('selectedSoundIndex', 0))
        )
        # Set layer reference on sounds after creation
        layer.__post_init__()
        return layer

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'sounds': [s.to_dict() for s in self.sounds],
            'chance': self.chance,
            'cooldownCycles': self.cooldown_cycles,
            'loopLengthMs': self.loop_length_ms,
            'weight': self.weight,
            'volume': self.volume,
            'mode': self.mode.value,
            'selectedSoundIndex': self.selected_sound_index
        }

    def get_active_preset_layer(self) -> Optional['PresetLayer']:
        """Get the active preset layer override for this layer, if any.
        
        Returns:
            The active PresetLayer if one exists in the environment's active preset,
            otherwise None.
        """
        if not self._environment:
            return None
            
        # Get the active preset
        active_preset = self._environment.get_active_preset()
        if not active_preset:
            return None
            
        # Find the preset layer with matching ID
        return next((pl for pl in active_preset.layers if pl.id == self.id), None)
    
    def get_effective_weight(self) -> float:
        """Get the effective weight for the layer, considering the layer weight and preset overrides."""
        preset_layer = self.get_active_preset_layer()
        if preset_layer:
            return preset_layer.weight
        return self.weight
    
    def get_effective_chance(self) -> float:
        """Get the effective chance for the layer, considering the layer chance and preset overrides."""
        preset_layer = self.get_active_preset_layer()
        if preset_layer:
            return preset_layer.chance
        return self.chance
    
    def get_effective_cooldown_cycles(self) -> int:
        """Get the effective cooldown cycles for the layer, considering the layer cooldown cycles and preset overrides."""
        preset_layer = self.get_active_preset_layer()
        if preset_layer:
            return preset_layer.cooldown_cycles
        return self.cooldown_cycles

@dataclass
class Environment:
    """Represents a complete audio environment"""
    id: str
    name: str
    max_weight: float
    layers: List[Layer]
    presets: List['Preset']
    background_image: Optional[str] = None
    soundboard: List[str] = None  # List of sound IDs for quick playback
    active_preset_id: Optional[str] = None
    play_state: PlayState = PlayState.STOPPED
    
    # Runtime-only fields (not serialized)
    _fade_start_time: Optional[float] = None
    _fade_end_time: Optional[float] = None
    _app_state: Optional['AppState'] = None

    def __post_init__(self):
        if self.soundboard is None:
            self.soundboard = []
            
        # Set environment reference on all layers
        for layer in self.layers:
            layer._environment = self

    @property
    def is_fading(self) -> bool:
        """Check if the environment is currently fading"""
        return bool(self._fade_start_time and self._fade_end_time)

    @property
    def fade_progress(self) -> float:
        """Get the current fade progress (0.0 to 1.0)"""
        if not self.is_fading or self._fade_start_time is None or self._fade_end_time is None:
            return 1.0 if self.play_state == PlayState.PLAYING else 0.0
            
        import time
        current_time = time.time()
        
        # Clamp progress between 0 and 1
        progress = max(0.0, min(1.0, 
            (current_time - self._fade_start_time) / 
            (self._fade_end_time - self._fade_start_time)
        ))
        
        # Invert progress for fade out (when state is STOPPED)
        return progress if self.play_state == PlayState.PLAYING else (1.0 - progress)

    def start_fade(self, fade_in: bool, duration_seconds: float, other_environments_playing: bool = False):
        """Start fading this environment in or out
        
        Args:
            fade_in: Whether to fade in (True) or out (False)
            duration_seconds: Duration of the fade in seconds
            other_environments_playing: Whether there are other environments currently playing
        """
        import time
        current_time = time.time()
        
        # Only apply fade-in timing if there are other environments playing
        # Always apply fade-out timing to ensure smooth transitions
        if fade_in and not other_environments_playing:
            self._fade_start_time = None
            self._fade_end_time = None
            self.play_state = PlayState.PLAYING
        else:
            self._fade_start_time = current_time
            self._fade_end_time = current_time + duration_seconds
            self.play_state = PlayState.PLAYING if fade_in else PlayState.STOPPED

    def update_fade_state(self):
        """Update the fade state based on current time"""
        if not self.is_fading:
            return
            
        # If fade is complete, clear the fade timing fields
        if self.fade_progress >= 1.0 or self.fade_progress <= 0.0:
            self._fade_start_time = None
            self._fade_end_time = None

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
            play_state=PlayState(data.get('playState', PlayState.STOPPED.value))
        )

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'maxWeight': self.max_weight,
            'layers': [l.to_dict() for l in self.layers],
            'presets': [p.to_dict() for p in self.presets],
            'backgroundImage': self.background_image,
            'soundboard': self.soundboard,
            'activePresetId': self.active_preset_id,
            'playState': self.play_state.value
        }

    def get_active_preset(self) -> Optional['Preset']:
        """Get the currently active preset if any"""
        if not self.active_preset_id:
            return None
        return next((p for p in self.presets if p.id == self.active_preset_id), None)

    def get_preset_layer(self, layer_id: str, preset: Optional['Preset'] = None) -> Optional['PresetLayer']:
        """Get preset layer override for a given layer ID"""
        if not preset:
            preset = self.get_active_preset()
        if not preset:
            return None
        return next((pl for pl in preset.layers if pl.id == layer_id), None)

    def get_effective_values(self) -> 'EffectiveEnvironment':
        """Get effective values with any active preset applied"""
        from .effective import EffectiveEnvironment, EffectiveLayer
        
        # Get active preset if any
        preset = self.get_active_preset()
        
        # Get effective max weight
        max_weight = preset.max_weight if preset and preset.max_weight is not None else self.max_weight
        
        # Get effective layers
        effective_layers = []
        for layer in self.layers:
            preset_layer = self.get_preset_layer(layer.id, preset)
            effective_layers.append(EffectiveLayer.from_layer(layer, preset_layer))
            
        return EffectiveEnvironment(
            id=self.id,
            name=self.name,
            max_weight=max_weight,
            layers=effective_layers,
            effects=self.effects,  # Effects aren't preset-overridable yet
            soundboard=self.soundboard  # Soundboard isn't preset-overridable yet
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
    effects: Effects = field(default_factory=Effects)  # Global effects configuration
    sound_files: List[SoundFile] = field(default_factory=list)  # All available sound files

    def __post_init__(self):
        # Set app_state reference on all environments
        for env in self.environments:
            env._app_state = self

    @property
    def active_environments(self) -> List[Environment]:
        """Get all environments that are currently active (playing or fading)"""
        return [env for env in self.environments 
                if env.play_state != PlayState.STOPPED]

    def set_environment_play_state(self, env_id: str, should_play: bool, fade_duration_seconds: float = 4.0) -> None:
        """Set the play state of an environment, handling fades appropriately.
        
        Args:
            env_id: ID of the environment to update
            should_play: Whether the environment should be playing
            fade_duration_seconds: Duration of the fade in/out in seconds
        """
        # Find the target environment
        env = next((e for e in self.environments if e.id == env_id), None)
        if not env:
            return
            
        # Check if there are other playing environments (excluding this one)
        other_environments_playing = any(
            e.play_state != PlayState.STOPPED 
            for e in self.environments 
            if e.id != env_id
        )
        
        # Start the fade
        env.start_fade(
            fade_in=should_play,
            duration_seconds=fade_duration_seconds,
            other_environments_playing=other_environments_playing
        )

    def get_environment_volume(self, env_id: str) -> float:
        """Get the effective volume for an environment including fade state"""
        env = next((e for e in self.environments if e.id == env_id), None)
        if not env:
            return 0.0
            
        # Base volume is master volume
        volume = self.master_volume
        
        # Apply fade progress
        if env.is_fading:
            volume *= env.fade_progress
        elif env.play_state == PlayState.STOPPED:
            volume = 0.0
            
        return volume

    @classmethod
    def from_dict(cls, data: Dict) -> 'AppState':
        app_state = cls(
            environments=[Environment.from_dict(e) for e in data['environments']],
            master_volume=float(data['masterVolume']),
            soundboard=data['soundboard'],
            effects=Effects.from_dict(data.get('effects', {})),
            sound_files=[SoundFile.from_dict(f) for f in data.get('files', [])]
        )
        # Set app_state reference
        app_state.__post_init__()
        return app_state

    def to_dict(self) -> Dict:
        """Convert the AppState to a dictionary"""
        return {
            'environments': [env.to_dict() for env in self.environments],
            'masterVolume': self.master_volume,
            'soundboard': self.soundboard,
            'effects': self.effects.to_dict(),
            'files': [sf.to_dict() for sf in self.sound_files]
        } 