const newLayer: Layer = {
  id: generateId(),
  name: layerName || file.name.split('.').slice(0, -1).join('.'),
  sounds: [
    {
      fileId: soundFile.id,
      volume: 0.8,
      weight: 1
    }
  ],
  chance: 1,
  cooldownCycles: 0,
  loopLengthMs: 0,
  weight: 1,
  volume: 1  // Add default layer volume
};

const newLayer: Layer = {
  id: generateId(),
  name: layerName || uploadedFile.name.split('.').slice(0, -1).join('.'),
  sounds: [
    {
      fileId: soundFile.id,
      volume: 0.8,
      weight: 1
    }
  ],
  chance: 1,
  cooldownCycles: 0,
  loopLengthMs: 0,
  weight: 1,
  volume: 1  // Add default layer volume
}; 