const newLayer: Layer = {
  id: generateId(),
  name: 'New Layer',
  sounds: [
    {
      fileId: soundFile.id,
      volume: 0.8,
      weight: 1
    }
  ],
  chance: 1,
  cooldownMs: 0,
  loopLengthMs: 0,
  weight: 1,
  volume: 1  // Add default layer volume
}; 