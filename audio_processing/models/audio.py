from dataclasses import dataclass, field
import time
from typing import List, Optional, Dict
from enum import Enum
import logging
import numpy as np
from pathlib import Path

logger = logging.getLogger(__name__)


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

    # Runtime-only fields (not serialized)
    audio_data: Optional[np.ndarray] = None  # Pre-processed audio data in int16 format

    def __post_init__(self):
        """Load audio data immediately after initialization"""
        from audio_processing.models.mixer import mixer
        try:
            sound_path = Path(self.path)
            if not sound_path.exists():
                logger.warning(f"Audio file not found during initialization: {sound_path}")
                return

            logger.info(f"Loading audio file during initialization: {sound_path}")
            self.audio_data = mixer.load_audio_file(sound_path)
            logger.info(f"Loaded audio file {self.id} - Shape: {self.audio_data.shape}")

        except Exception as e:
            logger.error(f"Error loading audio file {self.id} during initialization: {e}", exc_info=True)

    @classmethod
    def from_dict(cls, data: Dict) -> 'SoundFile':
        sound_file = cls(
            id=data['id'],
            name=data['name'],
            path=data['path'],
            peak_volume=float(data['peak_volume']),
            duration_ms=int(data['duration_ms']),
            original_filename=data.get('original_filename'),
            usage_count=int(data.get('usageCount', 0))
        )
        # __post_init__ will be called automatically and load the audio data
        return sound_file

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'path': self.path,
            'peak_volume': self.peak_volume,
            'duration_ms': self.duration_ms,
            'original_filename': self.original_filename,
            'usageCount': self.usage_count
        }


@dataclass
class LayerSound:
    """Represents a sound within a layer, with layer-specific settings"""
    id: str
    file_id: str  # Reference to a SoundFile
    frequency: float  # Frequency of selection within the layer
    volume: float  # Sound-specific volume adjustment

    # Runtime-only fields (not serialized)
    _layer: Optional['Layer'] = None
    _fade_start_time: Optional[float] = None
    _fade_end_time: Optional[float] = None
    _fade_volume_start: Optional[float] = None
    _fade_volume_end: Optional[float] = None

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

    @property
    def effective_volume(self) -> float:
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
        if (self._layer.environment and
                self._layer.environment.app_state and
                self._layer.environment.app_state.effects.normalize.enabled):
            # Find the sound file to get its peak volume
            sound_file = next(
                (sf for sf in self._layer.environment.app_state.sound_files
                 if sf.id == self.file_id),
                None
            )
            if sound_file and sound_file.peak_volume > 0:
                # Normalize by applying the inverse of the peak volume
                # This makes all sounds peak at the same level
                sound_volume /= sound_file.peak_volume

        return layer_volume * sound_volume

    @property
    def effective_volume_including_fade(self) -> float:
        """Get the effective volume for the sound, considering:
        1. Base sound volume or preset override
        2. Volume normalization (if enabled)
        3. Layer volume or preset override
        4. Fade state
        """
        effective_volume = self.effective_volume
        if self._fade_start_time and self._fade_end_time and self._fade_volume_start is not None:
            current_time = time.time()
            if current_time < self._fade_start_time:
                return self._fade_volume_start
            if current_time >= self._fade_end_time:
                return effective_volume

            # Calculate progress and clamp between 0 and 1
            fade_progress = (current_time - self._fade_start_time) / (self._fade_end_time - self._fade_start_time)
            fade_progress = max(0.0, min(1.0, fade_progress))

            # Linear interpolation from fade_volume_start to effective_volume
            return self._fade_volume_start + (self._fade_volume_end - self._fade_volume_start) * fade_progress
        return effective_volume

    @property
    def is_fading(self) -> bool:
        """Check if the sound is currently fading"""
        current_time = time.time()
        return bool(
            self._fade_start_time
            and self._fade_end_time
            and self._fade_start_time < current_time < self._fade_end_time
        )

    def start_fade_in(self, volume_start: float) -> None:
        """Start a fade in or out based on the current play state."""
        current_time = time.time()
        self._fade_start_time = current_time
        fade_duration = self._layer.environment.app_state.effects.fades.fade_in_duration / 1000  # Convert to seconds
        self._fade_end_time = current_time + fade_duration
        self._fade_volume_start = volume_start
        self._fade_volume_end = self.effective_volume

    def start_fade_out(self) -> None:
        """Start a fade out based on the current play state."""
        current_time = time.time()
        self._fade_start_time = current_time
        fade_duration = self._layer.environment.app_state.effects.fades.fade_in_duration / 1000  # Convert to seconds
        self._fade_end_time = current_time + fade_duration
        self._fade_volume_start = self.effective_volume
        self._fade_volume_end = 0.0

    @property
    def effective_frequency(self) -> float:
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
            """Controls attenuation of the speech frequency range when voice is detected.
            
            amount: Attenuation amount from 0 to 1, where:
                   0.0 = no attenuation
                   0.5 = -6 dB attenuation
                   1.0 = -12 dB attenuation
            """
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
        lowThreshold: float = -40.0
        highThreshold: float = 0.0
        ratio: float = 2.0

        def to_dict(self) -> Dict:
            return {
                "lowThreshold": self.lowThreshold,
                "highThreshold": self.highThreshold,
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
            # Handle both string and boolean values
            enabled = data['normalize'].get('enabled', False)
            if isinstance(enabled, str):
                effects.normalize.enabled = enabled.lower() == 'true'
            else:
                effects.normalize.enabled = bool(enabled)

        if 'fades' in data:
            effects.fades.fade_in_duration = int(data['fades'].get('fadeInDuration', 0))
            effects.fades.crossfade_duration = int(data['fades'].get('crossfadeDuration', 0))

        if 'filters' in data:
            filters = data['filters']
            if 'highPass' in filters:
                effects.filters.high_pass.frequency = float(filters['highPass'].get('frequency', 0.0))
            if 'lowPass' in filters:
                effects.filters.low_pass.frequency = float(filters['lowPass'].get('frequency', 20000.0))
            if 'dampenSpeechRange' in filters:
                effects.filters.dampen_speech_range.amount = float(filters['dampenSpeechRange'].get('amount', 0.0))

        if 'compressor' in data:
            comp = data['compressor']
            effects.compressor.lowThreshold = float(comp.get('lowThreshold', -40.0))
            effects.compressor.highThreshold = float(comp.get('highThreshold', 0.0))
            effects.compressor.ratio = float(comp.get('ratio', 2.0))

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
    environment: Optional['Environment'] = None

    def __post_init__(self):
        # Set layer reference on all sounds
        for sound in self.sounds:
            sound._layer = self

    def setenvironment(self, environment: 'Environment') -> None:
        """Set the environment reference for this layer"""
        if self.environment is environment:
            return

        self.environment = environment
        # Make sure all sounds have their layer reference
        for sound in self.sounds:
            sound._layer = self

    @classmethod
    def from_dict(cls, data: Dict) -> 'Layer':
        try:
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
        except Exception as e:
            logger.error(f"Error creating layer from dict: {e}", exc_info=True)
            raise

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
        """Get the active preset layer override for this layer, if any."""
        if not self.environment:
            logger.warning(f"No environment found for layer {self.id}")
            return None

        # Get the active preset
        active_preset = self.environment.get_active_preset()
        if not active_preset:
            return None

        # Find the preset layer with matching ID
        preset_layer = next((pl for pl in active_preset.layers if pl.id == self.id), None)
        if preset_layer:
            # Verify the preset layer has the correct base layer reference
            if preset_layer.base_layer is not self:
                preset_layer.base_layer = self
        return preset_layer

    @property
    def effective_weight(self) -> float:
        """Get the effective weight for the layer, considering the layer weight and preset overrides."""
        preset_layer = self.get_active_preset_layer()
        if preset_layer and preset_layer.weight is not None:
            return preset_layer.weight
        return self.weight

    @property
    def _effective_chance(self) -> float:
        """Get the effective chance for the layer, considering preset overrides."""
        preset_layer = self.get_active_preset_layer()
        if preset_layer and preset_layer.chance is not None:
            return preset_layer.chance
        return self.chance

    @property
    def effective_cooldown_cycles(self) -> int:
        """Get the effective cooldown cycles for the layer, considering preset overrides."""
        preset_layer = self.get_active_preset_layer()
        if preset_layer and preset_layer.cooldown_cycles is not None:
            return preset_layer.cooldown_cycles
        return self.cooldown_cycles

    def should_play(self, rolled_chance: float, passed_cooldown_cycles: int, weight_left: float) -> bool:
        """Check if the sound should play based on the chance, cooldown and weight."""
        if rolled_chance > self._effective_chance:
            return False
        if 0 < passed_cooldown_cycles <= self.effective_cooldown_cycles:
            return False
        if weight_left < self.effective_weight:
            return False
        return True


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
    app_state: Optional['AppState'] = None

    def __post_init__(self):
        if self.soundboard is None:
            self.soundboard = []

        for layer in self.layers:
            layer.setenvironment(self)

        # Set environment reference on all presets
        for preset in self.presets:
            preset.setenvironment(self)

    @property
    def is_fading(self) -> bool:
        """Check if the environment is currently fading"""
        if self._fade_start_time is None or self._fade_end_time is None:
            return False
            
        current_time = time.time()
        is_fading = (current_time >= self._fade_start_time and current_time < self._fade_end_time)
        
        # Debug log fade state changes
        if hasattr(self, '_last_fade_state'):
            if self._last_fade_state != is_fading:
                logger.debug(
                    f"Environment {self.id} fade state changed: {self._last_fade_state} -> {is_fading}"
                    + f" (current={current_time:.3f}, start={self._fade_start_time:.3f},"
                    + f" end={self._fade_end_time:.3f})")
        self._last_fade_state = is_fading
        
        return is_fading

    @property
    def fade_progress(self) -> float:
        """Get the current fade progress (0.0 to 1.0).
        For fade-in: starts at 0.0 and goes to 1.0
        For fade-out: starts at 1.0 and goes to 0.0
        """
        # If not fading, return the appropriate static value
        if not self.is_fading or self._fade_start_time is None or self._fade_end_time is None:
            return 1.0 if self.play_state == PlayState.PLAYING else 0.0

        current_time = time.time()

        # Calculate raw progress (0 to 1)
        raw_progress = max(0.0, min(1.0,
                            (current_time - self._fade_start_time) /
                            (self._fade_end_time - self._fade_start_time)
                            ))

        # For fade-in (PLAYING), we want to start at 0.0 and go to 1.0
        # For fade-out (STOPPED), we want to start at 1.0 and go to 0.0
        if self.play_state == PlayState.PLAYING:
            # Fade-in: use raw progress
            progress = raw_progress
        else:
            # Fade-out: start at 1.0 and decrease
            progress = 1.0 - raw_progress

        # Log significant progress changes
        if hasattr(self, '_last_progress'):
            if abs(progress - self._last_progress) >= 0.1:  # Log every 10% change
                logger.debug(
                    f"Environment {self.id} fade progress: {self._last_progress:.2f} -> {progress:.2f}"
                    + f" ({self.play_state.value})")
        self._last_progress = progress

        return progress

    def start_fade(self) -> None:
        """Start a fade in or out based on the current play state."""
        current_time = time.time()
        fade_duration = self.app_state.effects.fades.crossfade_duration / 1000  # Convert to seconds
        self._fade_start_time = current_time
        self._fade_end_time = current_time + fade_duration
        
        # Immediately check if we're fading
        is_fading = self.is_fading
        fade_progress = self.fade_progress
        
        logger.info(
            f"Starting fade {'in' if self.play_state == PlayState.PLAYING else 'out'}"
            + f" for environment {self.id} over {fade_duration}s"
            + f" (is_fading={is_fading}, fade_progress={fade_progress:.2f})")
        
        # Verify the fade state is correct
        if not is_fading:
            logger.error(
                f"Fade did not start correctly for environment {self.id}"
                + f" (start={self._fade_start_time}, end={self._fade_end_time})")
            
    def update_fade_state(self):
        """Update the fade state based on current time"""
        was_fading = self.is_fading
        if not was_fading:
            return

        # Get current fade progress
        progress = self.fade_progress
        
        # Check if fade is complete based on direction
        fade_complete = False
        if self.play_state == PlayState.PLAYING:
            # Fade-in is complete when progress reaches 1.0
            fade_complete = progress >= 1.0
        else:
            # Fade-out is complete when progress reaches 0.0
            fade_complete = progress <= 0.0
            
        if fade_complete:
            logger.info(
                f"Fade {'in' if self.play_state == PlayState.PLAYING else 'out'}"
                + f" complete for environment {self.id}"
                + f" (progress={progress:.2f})")
            self._fade_start_time = None
            self._fade_end_time = None

    @classmethod
    def from_dict(cls, data: Dict) -> 'Environment':
        from .presets import Preset  # Import here to avoid circular dependency
        try:
            layers = []
            for layer_data in data.get('layers', []):
                try:
                    layer = Layer.from_dict(layer_data)
                    layers.append(layer)
                except Exception as e:
                    logger.error(f"Error creating layer: {e}", exc_info=True)
                    raise

            # Extract presets
            presets = []
            if 'presets' in data:
                for preset_data in data['presets']:
                    try:
                        preset = Preset.from_dict(preset_data)
                        presets.append(preset)
                    except Exception as e:
                        logger.error(f"Error creating preset: {e}", exc_info=True)
                        raise

            # Create environment
            env = cls(
                id=data['id'],
                name=data['name'],
                max_weight=float(data['maxWeight']),
                layers=layers,
                presets=presets,
                background_image=data.get('backgroundImage'),
                soundboard=data.get('soundboard', []),
                active_preset_id=data.get('activePresetId'),
                play_state=PlayState(data.get('playState', PlayState.STOPPED.value))
            )

            # Post-init will set up all references
            env.__post_init__()

            return env

        except Exception as e:
            logger.error(f"Error creating environment: {e}", exc_info=True)
            raise

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        return {
            'id': self.id,
            'name': self.name,
            'maxWeight': self.max_weight,
            'layers': [layer_.to_dict() for layer_ in self.layers],
            'presets': [preset_.to_dict() for preset_ in self.presets],
            'backgroundImage': self.background_image,
            'soundboard': self.soundboard,
            'activePresetId': self.active_preset_id,
            'playState': self.play_state.value
        }

    def get_active_preset(self) -> Optional['Preset']:
        """Get the currently active preset if any"""
        preset = next((p for p in self.presets if p.id == self.active_preset_id), None)
        return preset

    @property
    def effective_max_weight(self) -> float:
        """Get the effective max weight for the environment, considering the preset overrides."""
        preset = self.get_active_preset()
        if preset and preset.max_weight is not None:
            return preset.max_weight
        return self.max_weight


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
            env.app_state = self

    @property
    def activeenvironments(self) -> List[Environment]:
        """Get all environments that are currently active (playing or fading)"""
        return [env for env in self.environments
                if env.play_state != PlayState.STOPPED]

    @classmethod
    def from_dict(cls, data: Dict) -> 'AppState':
        try:
            # Process environments first
            environments = []
            if 'environments' in data:
                for env_data in data['environments']:
                    try:
                        env = Environment.from_dict(env_data)
                        environments.append(env)
                    except Exception as e:
                        logger.error(f"Error creating environment: {e}", exc_info=True)

            # Handle sound files - preserve existing audio data
            sound_files = []
            if hasattr(cls, '_current_instance'):
                # Create a map of existing sound files by ID
                existing_sound_files = {sf.id: sf for sf in cls._current_instance.sound_files}
            else:
                existing_sound_files = {}

            for file_data in data.get('files', []):
                file_id = file_data['id']
                if file_id in existing_sound_files:
                    # Update existing sound file with new metadata but preserve audio data
                    sound_file = existing_sound_files[file_id]
                    sound_file.name = file_data['name']
                    sound_file.path = file_data['path']
                    sound_file.peak_volume = float(file_data['peak_volume'])
                    sound_file.duration_ms = int(file_data['duration_ms'])
                    sound_file.original_filename = file_data.get('original_filename')
                    sound_file.usage_count = int(file_data.get('usageCount', 0))
                    sound_files.append(sound_file)
                else:
                    # Create new sound file
                    sound_file = SoundFile.from_dict(file_data)
                    sound_files.append(sound_file)

            # Create app state
            app_state = cls(
                environments=environments,
                master_volume=float(data['masterVolume']),
                soundboard=data['soundboard'],
                effects=Effects.from_dict(data.get('effects', {})),
                sound_files=sound_files
            )

            # Store as current instance for future updates
            cls._current_instance = app_state

            # Set app_state reference and log
            app_state.__post_init__()

            return app_state
        except Exception as e:
            logger.error(f"Error creating AppState: {e}", exc_info=True)
            raise

    def to_dict(self) -> Dict:
        """Convert the AppState to a dictionary"""
        return {
            'environments': [env.to_dict() for env in self.environments],
            'masterVolume': self.master_volume,
            'soundboard': self.soundboard,
            'effects': self.effects.to_dict(),
            'files': [sf.to_dict() for sf in self.sound_files]
        }
