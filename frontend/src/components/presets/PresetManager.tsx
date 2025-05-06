import React, { useState } from 'react';
import { EnvironmentPreset, Layer } from '../../types/audio';

interface PresetManagerProps {
  presets: EnvironmentPreset[];
  activePresetId: string | null;
  layers: Layer[];
  onPresetSelect: (presetId: string) => void;
  onPresetCreate: (name: string) => void;
  onPresetDelete: (presetId: string) => void;
  onPresetUpdate: (preset: EnvironmentPreset) => void;
}

const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  activePresetId,
  layers,
  onPresetSelect,
  onPresetCreate,
  onPresetDelete,
  onPresetUpdate,
}) => {
  const [newPresetName, setNewPresetName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreatePreset = () => {
    if (newPresetName.trim()) {
      onPresetCreate(newPresetName.trim());
      setNewPresetName('');
      setIsCreating(false);
    }
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-center space-x-4">
        {/* Preset Tabs */}
        <div className="flex-1 flex space-x-2 overflow-x-auto pb-2">
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onPresetSelect(preset.id)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                activePresetId === preset.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Create Preset Button */}
        {!isCreating ? (
          <button
            onClick={() => setIsCreating(true)}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Preset</span>
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Preset name..."
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreatePreset();
                } else if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewPresetName('');
                }
              }}
            />
            <button
              onClick={handleCreatePreset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setNewPresetName('');
              }}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Layer Overrides */}
      {activePresetId && (
        <div className="mt-4 space-y-4">
          {layers.map((layer) => {
            const override = presets.find((p) => p.id === activePresetId)?.layerOverrides[layer.id];
            return (
              <div key={layer.id} className="flex items-center space-x-4">
                <span className="w-48 text-sm font-medium text-gray-700">{layer.name}</span>
                <div className="flex-1 flex items-center space-x-4">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Chance</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={override?.chance ?? layer.chance}
                      onChange={(e) => {
                        const preset = presets.find((p) => p.id === activePresetId);
                        if (preset) {
                          onPresetUpdate({
                            ...preset,
                            layerOverrides: {
                              ...preset.layerOverrides,
                              [layer.id]: {
                                ...preset.layerOverrides[layer.id],
                                chance: parseFloat(e.target.value),
                              },
                            },
                          });
                        }
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Volume</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={override?.volume ?? layer.volume}
                      onChange={(e) => {
                        const preset = presets.find((p) => p.id === activePresetId);
                        if (preset) {
                          onPresetUpdate({
                            ...preset,
                            layerOverrides: {
                              ...preset.layerOverrides,
                              [layer.id]: {
                                ...preset.layerOverrides[layer.id],
                                volume: parseFloat(e.target.value),
                              },
                            },
                          });
                        }
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PresetManager; 