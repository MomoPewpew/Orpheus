import { Preset, Layer } from '../types';

if (activePreset && activePreset.layers) {
  const presetLayer = activePreset.layers.find(l => l.id === layer.id) as Partial<Layer>;
  if (presetLayer) {
    // Copy all properties from the preset layer back to default
    Object.keys(presetLayer).forEach((property: string) => {
      // ... existing code ...
    });
  }
} 