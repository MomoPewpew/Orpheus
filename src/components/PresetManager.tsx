import { Preset, Layer } from '../types';

const newPreset: Preset = {
  name: newPresetName.trim(),
  environmentId: environment.id,
  layers: [] as (Partial<Layer> & { id: string })[]
};

onPresetCreate(newPreset); 