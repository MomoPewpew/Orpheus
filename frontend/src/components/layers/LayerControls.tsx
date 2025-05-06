import React from 'react';
import { Layer } from '../../types/audio';

interface LayerControlsProps {
  layer: Layer;
  onUpdate: (layer: Layer) => void;
  onDelete: () => void;
}

const LayerControls: React.FC<LayerControlsProps> = ({ layer, onUpdate, onDelete }) => {
  const handleChange = (field: keyof Layer, value: any) => {
    onUpdate({ ...layer, [field]: value });
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={layer.name}
            onChange={(e) => handleChange('name', e.target.value)}
            className="w-full px-4 py-2 text-lg font-medium bg-transparent border-b-2 border-gray-200 focus:outline-none focus:border-blue-500"
            placeholder="Layer Name"
          />
        </div>
        <button
          onClick={onDelete}
          className="ml-4 p-2 text-gray-400 hover:text-red-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Sound File Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sound File</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={layer.soundFile.name}
                readOnly
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                <span>Browse</span>
              </button>
            </div>
          </div>

          {/* Chance Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chance to Play ({Math.round(layer.chance * 100)}%)
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

          {/* Volume Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Volume ({Math.round(layer.volume * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={layer.volume}
              onChange={(e) => handleChange('volume', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Cooldown Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cooldown (ms)</label>
            <input
              type="number"
              value={layer.cooldownMs}
              onChange={(e) => handleChange('cooldownMs', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Loop Length Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Loop Length (ms)</label>
            <input
              type="number"
              value={layer.loopLengthMs}
              onChange={(e) => handleChange('loopLengthMs', parseInt(e.target.value))}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Weight Slider */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Weight ({layer.weight})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={layer.weight}
              onChange={(e) => handleChange('weight', parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LayerControls; 