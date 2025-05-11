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
 * Represents a sound within a layer, with layer-specific settings
 */
export interface LayerSound {
  fileId: string;    // Reference to a SoundFile
  weight: number;    // Weight for random selection within the layer
  volume: number;    // Sound-specific volume adjustment
}

/**
 * Represents a layer in an environment (e.g., background music, ambient sounds)
 */
export interface Layer {
  id: string;
  name: string;
  sounds: LayerSound[];  // List of possible sounds for this layer
  chance: number;      // Probability of playing (0-1)
  cooldownMs: number;  // Cooldown in cycles
  loopLengthMs: number; // Length of a cycle in milliseconds
  weight: number;      // How much this layer contributes to the total environment weight
}

/**
 * Represents layer-specific overrides for a preset
 */
export interface LayerPresetOverrides {
  chance?: number;     // Optional override for chance (0-1)
  volume?: number;     // Optional override for volume (0-1)
  weight?: number;     // Optional override for layer weight
}

/**
 * Represents a preset configuration for an environment
 */
export interface EnvironmentPreset {
  id: string;
  name: string;        // e.g., "High Tension", "Peaceful", "Combat"
  environmentId: string; // Reference to parent environment
  layerOverrides: Record<string, LayerPresetOverrides>; // Map of layer ID to overrides
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
  maxWeight: number;         // Maximum total weight allowed for active layers
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
  currentWeight: number;     // Current total weight of active layers
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
 * Type guard to check if an object is a valid LayerSound
 */
export function isLayerSound(obj: any): obj is LayerSound {
  return (
    typeof obj === 'object' &&
    typeof obj.fileId === 'string' &&
    typeof obj.weight === 'number' &&
    typeof obj.volume === 'number'
  );
}

/**
 * Type guard to check if an object is a valid LayerPresetOverrides
 */
export function isLayerPresetOverrides(obj: any): obj is LayerPresetOverrides {
  return (
    typeof obj === 'object' &&
    (obj.chance === undefined || (typeof obj.chance === 'number' && obj.chance >= 0 && obj.chance <= 1)) &&
    (obj.volume === undefined || (typeof obj.volume === 'number' && obj.volume >= 0 && obj.volume <= 1)) &&
    (obj.weight === undefined || typeof obj.weight === 'number')
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
    typeof obj.layerOverrides === 'object' &&
    Object.keys(obj.layerOverrides).every(key => isLayerPresetOverrides(obj.layerOverrides[key]))
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
    Array.isArray(obj.sounds) &&
    obj.sounds.every(isLayerSound) &&
    typeof obj.chance === 'number' &&
    typeof obj.cooldownMs === 'number' &&
    typeof obj.loopLengthMs === 'number' &&
    typeof obj.weight === 'number'
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
    (obj.defaultPresetId === undefined || typeof obj.defaultPresetId === 'string') &&
    typeof obj.maxWeight === 'number'
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
    (obj.activePresetId === undefined || typeof obj.activePresetId === 'string') &&
    typeof obj.currentWeight === 'number'
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
): { chance: number; weight: number; sounds: LayerSound[] } {
  if (!preset) {
    return { 
      chance: layer.chance,
      weight: layer.weight,
      sounds: layer.sounds
    };
  }

  const override = preset.layerOverrides[layer.id];
  return {
    chance: override?.chance ?? layer.chance,
    weight: override?.weight ?? layer.weight,
    sounds: layer.sounds.map(sound => ({
      ...sound,
      volume: override?.volume !== undefined ? sound.volume * override.volume : sound.volume
    }))
  };
}

/**
 * Helper function to check if adding a layer would exceed the environment's max weight
 */
export function canAddLayer(
  activeEnvironment: ActiveEnvironment,
  layer: Layer,
  preset?: EnvironmentPreset
): boolean {
  const { weight } = getEffectiveLayerSettings(layer, preset);
  return activeEnvironment.currentWeight + weight <= activeEnvironment.environment.maxWeight;
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

/**
 * Helper function to get the effective volume for a layer (average of all sound volumes)
 */
export function getLayerVolume(layer: Layer): number {
    if (layer.sounds.length === 0) return 1;
    return layer.sounds.reduce((sum, sound) => sum + sound.volume, 0) / layer.sounds.length;
}

/**
 * Helper function to set the volume for all sounds in a layer
 */
export function setLayerVolume(layer: Layer, volume: number): Layer {
    return {
        ...layer,
        sounds: layer.sounds.map(sound => ({
            ...sound,
            volume
        }))
    };
}

/**
 * Helper function to get the primary sound name for a layer (first sound or placeholder)
 */
export function getLayerSoundName(layer: Layer, soundFiles?: SoundFile[]): string {
    if (layer.sounds.length === 0) return "No sound selected";
    if (!soundFiles || soundFiles.length === 0) return "Loading sounds...";
    const primarySound = soundFiles.find(sf => sf.id === layer.sounds[0].fileId);
    return primarySound?.name || "Unknown sound";
} 