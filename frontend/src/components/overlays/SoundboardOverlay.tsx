import React, { useState } from 'react';
import { SoundFile } from '../../types/audio';

interface SoundboardOverlayProps {
  soundboard: SoundFile[];
  onClose: () => void;
  onPlay: (sound: SoundFile) => void;
  onAddSound: (sound: SoundFile) => void;
  onRemoveSound: (soundId: string) => void;
}

const SoundboardOverlay: React.FC<SoundboardOverlayProps> = ({
  soundboard,
  onClose,
  onPlay,
  onAddSound,
  onRemoveSound,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSounds = soundboard.filter(sound =>
    sound.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-800">Soundboard</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Search and Add Button */}
        <div className="p-4 border-b flex items-center space-x-4">
          <input
            type="text"
            placeholder="Search sounds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setIsAdding(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Sound
          </button>
        </div>

        {/* Sound Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredSounds.map((sound) => (
              <div
                key={sound.id}
                className="bg-gray-50 rounded-lg p-4 flex flex-col"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-800">{sound.name}</h3>
                  <button
                    onClick={() => onRemoveSound(sound.id)}
                    className="text-gray-400 hover:text-red-600 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <button
                  onClick={() => onPlay(sound)}
                  className="mt-auto px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Play
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add Sound Modal */}
        {isAdding && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Add New Sound</h3>
              {/* Add sound form will go here */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setIsAdding(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoundboardOverlay; 