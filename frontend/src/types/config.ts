import { Environment, Layer, EnvironmentPreset, SoundFile } from './audio';

export interface AudioFile {
  id: string;
  name: string;
  path: string;
  peakVolume: number;
  lengthMs: number;
}

export interface AppConfig {
  environments: Environment[];
  files: AudioFile[];
}

// Helper functions to convert between AudioFile and SoundFile
export function audioFileToSoundFile(file: AudioFile): SoundFile {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    volume: 1, // Default volume multiplier
    lengthMs: file.lengthMs
  };
}

export function soundFileToAudioFile(file: SoundFile): AudioFile {
  return {
    id: file.id,
    name: file.name,
    path: file.path,
    peakVolume: 1, // This should be calculated when the file is loaded
    lengthMs: file.lengthMs
  };
} 