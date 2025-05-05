/**
 * Represents a sound file in the system
 */
export interface SoundFile {
  id: string;
  name: string;
  path: string;
  volume: number;
  lengthMs: number;  // Length in milliseconds
}

/**
 * Represents a layer in an environment (e.g., background music, ambient sounds)
 */
export interface Layer {
  id: string;
  name: string;
  soundFile: SoundFile;
  chance: number;      // Probability of playing (0-1)
  cooldownMs: number;  // Cooldown in milliseconds
  volume: number;      // Layer-specific volume (0-1)
  loopLengthMs: number; // Loop duration in milliseconds
}

/**
 * Represents layer-specific overrides for a preset
 */
export interface LayerPresetOverrides {
  layerId: string;
  chance?: number;     // Optional override for chance (0-1)
  volume?: number;     // Optional override for volume (0-1)
}

/**
 * Represents a preset configuration for an environment
 */
export interface EnvironmentPreset {
  id: string;
  name: string;        // e.g., "High Tension", "Peaceful", "Combat"
  environmentId: string; // Reference to parent environment
  layerOverrides: LayerPresetOverrides[]; // Overrides for specific layers
}

/**
 * Represents a complete audio environment (e.g., "Town", "Dungeon")
 */
export interface Environment {
  id: string;
  name: string;
  backgroundImage?: string;  // Optional URL/path to background image
  layers: Layer[];
  soundboard: SoundFile[];   // Environment-specific soundboard entries
  presets: EnvironmentPreset[]; // Available presets for this environment
  defaultPresetId?: string;  // Default preset to use when environment is first loaded
}

/**
 * Represents the playback state of the application
 */
export enum PlayState {
  Playing = 'PLAYING',
  Stopped = 'STOPPED',
  Loading = 'LOADING'  // For when we're loading a new environment or initializing
}

/**
 * Represents the active environment and its state
 */
export interface ActiveEnvironment {
  environment: Environment;
  activeLayerIds: string[];  // IDs of layers currently playing
  activePresetId?: string;   // Currently active preset, if any
}

/**
 * Represents the complete application state
 */
export interface AppState {
  environments: Environment[];
  masterVolume: number;      // Global volume multiplier (0-1)
  globalSoundboard: SoundFile[]; // Sound effects available in all environments
  playState: PlayState;      // Current play state of the application
  activeEnvironment?: ActiveEnvironment; // Currently active environment and its state
}

/**
 * Type guard to check if an object is a valid SoundFile
 */
export function isSoundFile(obj: any): obj is SoundFile {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.path === 'string' &&
    typeof obj.volume === 'number' &&
    typeof obj.lengthMs === 'number'
  );
}

/**
 * Type guard to check if an object is a valid LayerPresetOverrides
 */
export function isLayerPresetOverrides(obj: any): obj is LayerPresetOverrides {
  return (
    typeof obj === 'object' &&
    typeof obj.layerId === 'string' &&
    (obj.chance === undefined || (typeof obj.chance === 'number' && obj.chance >= 0 && obj.chance <= 1)) &&
    (obj.volume === undefined || (typeof obj.volume === 'number' && obj.volume >= 0 && obj.volume <= 1))
  );
}

/**
 * Type guard to check if an object is a valid EnvironmentPreset
 */
export function isEnvironmentPreset(obj: any): obj is EnvironmentPreset {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.environmentId === 'string' &&
    Array.isArray(obj.layerOverrides) &&
    obj.layerOverrides.every(isLayerPresetOverrides)
  );
}

/**
 * Type guard to check if an object is a valid Layer
 */
export function isLayer(obj: any): obj is Layer {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    isSoundFile(obj.soundFile) &&
    typeof obj.chance === 'number' &&
    typeof obj.cooldownMs === 'number' &&
    typeof obj.volume === 'number' &&
    typeof obj.loopLengthMs === 'number'
  );
}

/**
 * Type guard to check if an object is a valid Environment
 */
export function isEnvironment(obj: any): obj is Environment {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.backgroundImage === undefined || typeof obj.backgroundImage === 'string') &&
    Array.isArray(obj.layers) &&
    obj.layers.every(isLayer) &&
    Array.isArray(obj.soundboard) &&
    obj.soundboard.every(isSoundFile) &&
    Array.isArray(obj.presets) &&
    obj.presets.every(isEnvironmentPreset) &&
    (obj.defaultPresetId === undefined || typeof obj.defaultPresetId === 'string')
  );
}

/**
 * Type guard to check if an object is a valid ActiveEnvironment
 */
export function isActiveEnvironment(obj: any): obj is ActiveEnvironment {
  return (
    typeof obj === 'object' &&
    isEnvironment(obj.environment) &&
    Array.isArray(obj.activeLayerIds) &&
    obj.activeLayerIds.every((id: any) => typeof id === 'string') &&
    (obj.activePresetId === undefined || typeof obj.activePresetId === 'string')
  );
}

/**
 * Type guard to check if an object is a valid AppState
 */
export function isAppState(obj: any): obj is AppState {
  return (
    typeof obj === 'object' &&
    Array.isArray(obj.environments) &&
    obj.environments.every(isEnvironment) &&
    typeof obj.masterVolume === 'number' &&
    obj.masterVolume >= 0 &&
    obj.masterVolume <= 1 &&
    Array.isArray(obj.globalSoundboard) &&
    obj.globalSoundboard.every(isSoundFile) &&
    typeof obj.playState === 'string' &&
    Object.values(PlayState).includes(obj.playState) &&
    (obj.activeEnvironment === undefined || isActiveEnvironment(obj.activeEnvironment))
  );
}

/**
 * Helper function to get the effective layer settings considering preset overrides
 */
export function getEffectiveLayerSettings(
  layer: Layer,
  preset?: EnvironmentPreset
): { chance: number; volume: number } {
  if (!preset) {
    return { chance: layer.chance, volume: layer.volume };
  }

  const override = preset.layerOverrides.find(o => o.layerId === layer.id);
  return {
    chance: override?.chance ?? layer.chance,
    volume: override?.volume ?? layer.volume
  };
}

/**
 * Serialization helpers
 */
export const serializeEnvironment = (env: Environment): string => {
  return JSON.stringify(env, null, 2);
};

export const deserializeEnvironment = (json: string): Environment | null => {
  try {
    const obj = JSON.parse(json);
    if (isEnvironment(obj)) {
      return obj;
    }
    return null;
  } catch {
    return null;
  }
};

export const serializeAppState = (state: AppState): string => {
  return JSON.stringify(state, null, 2);
};

export const deserializeAppState = (json: string): AppState | null => {
  try {
    const obj = JSON.parse(json);
    if (isAppState(obj)) {
      return obj;
    }
    return null;
  } catch {
    return null;
  }
}; 