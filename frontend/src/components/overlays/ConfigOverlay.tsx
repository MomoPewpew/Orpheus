import React from 'react';

interface ConfigOverlayProps {
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  onClose: () => void;
}

const ConfigOverlay: React.FC<ConfigOverlayProps> = ({
  masterVolume,
  onMasterVolumeChange,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ×
          </button>
        </div>

        <div className="space-y-6">
          {/* Master Volume */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Master Volume ({Math.round(masterVolume * 100)}%)
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={masterVolume}
              onChange={(e) => onMasterVolumeChange(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Audio Device Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Output Device
            </label>
            <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="default">Default Device</option>
              {/* Device list will be populated dynamically */}
            </select>
          </div>

          {/* Additional settings can be added here */}
        </div>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfigOverlay; 