import { generateId } from '../utils/ids';

/**
 * Represents a sound file in the system
 */
export interface SoundFile {
  id: string;
  name: string;
  path: string;
  peak_volume: number;
  duration_ms: number;
  original_filename?: string;
  usageCount: number;
}

/**
 * Represents a sound within a layer, with layer-specific settings
 */
export interface LayerSound {
  id: string;       // Unique identifier for this sound instance
  fileId: string;   // Reference to a SoundFile
  frequency: number; // Frequency of selection within the layer (was weight)
  volume: number;    // Sound-specific volume adjustment
}

/**
 * Represents the playback mode of a layer
 */
export enum LayerMode {
  Shuffle = 'SHUFFLE',
  Sequence = 'SEQUENCE',
  Single = 'SINGLE'
}

/**
 * Represents a layer in an environment (e.g., background music, ambient sounds)
 */
export interface Layer {
  id: string;
  name: string;
  sounds: LayerSound[];  // List of possible sounds for this layer
  chance: number;      // Probability of playing (0-1)
  cooldownCycles?: number;  // Cooldown in cycles
  loopLengthMs?: number; // Length of a cycle in milliseconds
  weight: number;      // How much this layer contributes to the total environment weight
  volume: number;      // Layer-level volume multiplier (0-1)
  mode: LayerMode;     // Playback mode of the layer
  selectedSoundIndex: number; // Index of the currently selected sound in the sounds array
}

/**
 * Represents the audio effects configuration
 */
export interface Effects {
  normalize: {
    enabled: boolean;
  };
  fades: {
    fadeInDuration: number;
    crossfadeDuration: number;
  };
  filters: {
    highPass: {
      frequency: number;
    };
    lowPass: {
      frequency: number;
    };
    dampenSpeechRange: {
      amount: number;
    };
  };
  compressor: {
    lowThreshold: number;
    highThreshold: number;
    ratio: number;
  };
}

/**
 * Represents the playback state of an environment
 */
export enum PlayState {
  Playing = 'PLAYING',
  Stopped = 'STOPPED'
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
 * Represents a complete audio environment (e.g., "Town", "Dungeon")
 */
export interface Environment {
  id: string;
  name: string;
  maxWeight: number;
  layers: Layer[];
  presets: Preset[];
  backgroundImage?: string;
  soundboard: string[]; // List of sound IDs for quick playback
  activePresetId?: string;  // undefined means using default preset
  effects?: Effects;  // Audio effects configuration
  playState: PlayState; // Current play state of this environment
}

/**
 * Represents the complete application state
 */
export interface AppState {
  environments: Environment[];
  masterVolume: number;      // Global volume multiplier (0-1)
  soundboard: string[];      // Global sound IDs available in all environments
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
    typeof obj.peak_volume === 'number' &&
    typeof obj.duration_ms === 'number' &&
    (obj.original_filename === undefined || typeof obj.original_filename === 'string') &&
    typeof obj.usageCount === 'number'
  );
}

/**
 * Type guard to check if an object is a valid LayerSound
 */
export function isLayerSound(obj: any): obj is LayerSound {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.fileId === 'string' &&
    typeof obj.frequency === 'number' &&
    typeof obj.volume === 'number'
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
    typeof obj.cooldownCycles === 'number' &&
    typeof obj.loopLengthMs === 'number' &&
    typeof obj.weight === 'number' &&
    typeof obj.volume === 'number' &&
    typeof obj.mode === 'string' &&
    Object.values(LayerMode).includes(obj.mode) &&
    typeof obj.selectedSoundIndex === 'number' &&
    obj.selectedSoundIndex >= 0 &&
    (!obj.sounds.length || obj.selectedSoundIndex < obj.sounds.length)
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
    obj.soundboard.every((id: any) => typeof id === 'string') &&
    Array.isArray(obj.presets) &&
    obj.presets.every(isPreset) &&
    typeof obj.maxWeight === 'number' &&
    (obj.activePresetId === undefined || typeof obj.activePresetId === 'string') &&
    (obj.effects === undefined || typeof obj.effects === 'object') &&
    typeof obj.playState === 'string' &&
    Object.values(PlayState).includes(obj.playState)
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
    Array.isArray(obj.soundboard) &&
    obj.soundboard.every((id: any) => typeof id === 'string') &&
    typeof obj.playState === 'string' &&
    Object.values(PlayState).includes(obj.playState) &&
    (obj.activeEnvironment === undefined || isActiveEnvironment(obj.activeEnvironment))
  );
}

/**
 * Represents a sound override in a preset
 */
export interface PresetSound {
  id: string;       // Must match the original sound ID
  fileId: string;   // Must match the original sound's fileId
  volume?: number;  // Override for the sound's volume
  frequency?: number; // Override for the sound's frequency
}

/**
 * Represents a layer override in a preset
 */
export interface PresetLayer {
  id: string;           // Must match the original layer ID
  volume?: number;      // Override for the layer's volume
  weight?: number;      // Override for the layer's weight
  chance?: number;      // Override for the layer's chance
  cooldownCycles?: number; // Override for the layer's cooldown cycles
  mode?: LayerMode;     // Override for the layer's mode
  sounds?: PresetSound[]; // Sound-specific overrides
}

/**
 * Represents a preset configuration for an environment
 */
export interface Preset {
  id: string;
  name: string;
  maxWeight?: number;   // Optional override for environment's maxWeight
  layers: PresetLayer[];  // Layer-specific overrides
}

/**
 * Type guard to check if an object is a valid PresetSound
 */
export function isPresetSound(obj: any): obj is PresetSound {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.fileId === 'string' &&
    (obj.volume === undefined || typeof obj.volume === 'number') &&
    (obj.frequency === undefined || typeof obj.frequency === 'number')
  );
}

/**
 * Type guard to check if an object is a valid PresetLayer
 */
export function isPresetLayer(obj: any): obj is PresetLayer {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    (obj.volume === undefined || typeof obj.volume === 'number') &&
    (obj.weight === undefined || typeof obj.weight === 'number') &&
    (obj.chance === undefined || typeof obj.chance === 'number') &&
    (obj.cooldownCycles === undefined || typeof obj.cooldownCycles === 'number') &&
    (obj.mode === undefined || Object.values(LayerMode).includes(obj.mode)) &&
    (!obj.sounds || (Array.isArray(obj.sounds) && obj.sounds.every(isPresetSound)))
  );
}

/**
 * Type guard to check if an object is a valid Preset
 */
export function isPreset(obj: any): obj is Preset {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    (obj.maxWeight === undefined || typeof obj.maxWeight === 'number') &&
    Array.isArray(obj.layers) &&
    obj.layers.every(isPresetLayer)
  );
}

/**
 * Helper function to get the effective layer settings considering preset values
 */
export function getEffectiveLayerSettings(
  layer: Layer,
  preset?: Preset
): Layer {
  if (!preset) return layer;

  // Find the preset layer that matches this layer's ID
  const presetLayer = preset.layers.find(p => p.id === layer.id);
  if (!presetLayer) return layer;

  // Merge the preset values with the base layer
  const effectiveLayer = { ...layer };

  // Apply layer-level overrides if they exist
  if (presetLayer.volume !== undefined) effectiveLayer.volume = presetLayer.volume;
  if (presetLayer.weight !== undefined) effectiveLayer.weight = presetLayer.weight;
  if (presetLayer.chance !== undefined) effectiveLayer.chance = presetLayer.chance;

  // Apply sound-level overrides if any exist
  if (presetLayer.sounds) {
    effectiveLayer.sounds = layer.sounds.map(sound => {
      const presetSound = presetLayer.sounds?.find(ps => ps.id === sound.id);
      if (!presetSound) return sound;

      return {
        ...sound,
        fileId: presetSound.fileId, // Use the preset's fileId if it exists
        volume: presetSound.volume ?? sound.volume,
        frequency: presetSound.frequency ?? sound.frequency
      };
    });
  }

  return effectiveLayer;
}

/**
 * Creates a new preset layer by comparing base and modified layers
 */
export function createPresetLayer(baseLayer: Layer, modifiedLayer: Layer): PresetLayer {
  const presetLayer: PresetLayer = { id: baseLayer.id };

  // Only include values that differ from the base
  if (modifiedLayer.volume !== baseLayer.volume) presetLayer.volume = modifiedLayer.volume;
  if (modifiedLayer.weight !== baseLayer.weight) presetLayer.weight = modifiedLayer.weight;
  if (modifiedLayer.chance !== baseLayer.chance) presetLayer.chance = modifiedLayer.chance;
  if (modifiedLayer.cooldownCycles !== baseLayer.cooldownCycles) presetLayer.cooldownCycles = modifiedLayer.cooldownCycles;

  // Compare sounds and include only those with changes
  const soundChanges = modifiedLayer.sounds
    .map(sound => {
      const baseSound = baseLayer.sounds.find(s => s.id === sound.id);
      if (!baseSound) return null;

      const changes: PresetSound = { 
        id: sound.id,
        fileId: sound.fileId // Always include fileId
      };
      let hasChanges = false;

      if (sound.volume !== baseSound.volume) {
        changes.volume = sound.volume;
        hasChanges = true;
      }
      if (sound.frequency !== baseSound.frequency) {
        changes.frequency = sound.frequency;
        hasChanges = true;
      }

      return hasChanges ? changes : null;
    })
    .filter((sound): sound is PresetSound => sound !== null);

  if (soundChanges.length > 0) {
    presetLayer.sounds = soundChanges;
  }

  return presetLayer;
}

/**
 * Creates a new preset from the current state of an environment
 */
export function createPreset(
  environment: Environment,
  name: string,
  basePreset?: Preset
): Preset {
  const baseLayers = basePreset 
    ? environment.layers.map(layer => getEffectiveLayerSettings(layer, basePreset))
    : environment.layers;

  return {
    id: generateId(),
    name,
    layers: environment.layers
      .map((layer, index) => createPresetLayer(baseLayers[index], layer))
      .filter(layer => 
        layer.volume !== undefined || 
        layer.weight !== undefined || 
        layer.chance !== undefined ||
        layer.sounds !== undefined
      )
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

/**
 * Helper function to check if adding a layer would exceed the environment's max weight
 */
export function canAddLayer(
  activeEnvironment: ActiveEnvironment,
  layer: Layer,
  preset?: Preset
): boolean {
  const { weight } = getEffectiveLayerSettings(layer, preset);
  return activeEnvironment.currentWeight + weight <= activeEnvironment.environment.maxWeight;
}

/**
 * Apply a preset to an environment
 */
export function applyPreset(environment: Environment, preset: Preset): Environment {
  // Apply the preset's overrides to the environment
  const updatedEnvironment = { ...environment };
  
  if (preset.maxWeight !== undefined) {
    updatedEnvironment.maxWeight = preset.maxWeight;
  }

  // Apply layer overrides
  updatedEnvironment.layers = environment.layers.map(layer => {
    return getEffectiveLayerSettings(layer, preset);
  });

  return updatedEnvironment;
} 