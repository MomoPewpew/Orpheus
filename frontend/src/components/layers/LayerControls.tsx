import React from 'react';
import { Layer, getLayerVolume, setLayerVolume, getLayerSoundName, SoundFile } from '../../types/audio';

interface LayerControlsProps {
  layer: Layer;
  soundFiles: SoundFile[];
  onLayerChange: (updatedLayer: Layer) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layer,
  soundFiles,
  onLayerChange
}) => {
  const handleChange = (property: keyof Layer | 'volume', value: number | string) => {
    if (property === 'volume') {
      onLayerChange(setLayerVolume(layer, value as number));
    } else {
      onLayerChange({
        ...layer,
        [property]: value
      });
    }
  };

  const currentVolume = getLayerVolume(layer);
  const soundName = getLayerSoundName(layer, soundFiles);

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Sound File
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={soundName}
            readOnly
            className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            onClick={() => {/* TODO: Implement sound file selection */}}
          >
            Select
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chance ({Math.round(layer.chance * 100)}%)
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={layer.chance}
          onChange={(e) => handleChange('chance', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Volume ({Math.round(currentVolume * 100)}%)
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={currentVolume}
          onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Weight ({layer.weight})
        </label>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={layer.weight}
          onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}; 