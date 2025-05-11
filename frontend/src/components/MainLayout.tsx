import React from 'react';
import { Environment, EnvironmentPreset, Layer, SoundFile } from '../types/audio';
import Sidebar from './Sidebar';
import '../styles/AppLayout.css';

interface MainLayoutProps {
  environments: Environment[];
  activeEnvironment?: Environment;
  activePresetId?: string;
  masterVolume: number;
  soundboard: SoundFile[];
  onNewEnvironment: () => void;
  onToggleConfig: () => void;
  onToggleSoundboard: () => void;
  onEnvironmentSelect: (environment: Environment) => void;
  onPresetSelect: (presetId: string) => void;
  onPresetCreate: (name: string, basePresetId?: string) => void;
  onPresetDelete: (presetId: string) => void;
  onPresetUpdate: (preset: EnvironmentPreset) => void;
  onLayerUpdate: (layer: Layer) => void;
  onLayerDelete: (layerId: string) => void;
  onLayerAdd: () => void;
  onMasterVolumeChange: (volume: number) => void;
  onSoundPlay: (sound: SoundFile) => void;
  onSoundAdd: (sound: SoundFile) => void;
  onSoundRemove: (soundId: string) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  environments,
  activeEnvironment,
  onNewEnvironment,
  onToggleConfig,
  onToggleSoundboard,
  onEnvironmentSelect,
  masterVolume,
  onMasterVolumeChange,
  onSoundAdd,
  onSoundRemove,
  ...props
}) => {
  return (
    <div className="app-layout">
      <Sidebar 
        environments={environments}
        activeEnvironment={activeEnvironment}
        onNewEnvironment={onNewEnvironment}
        onToggleConfig={onToggleConfig}
        onToggleSoundboard={onToggleSoundboard}
        onEnvironmentSelect={onEnvironmentSelect}
        masterVolume={masterVolume}
        onMasterVolumeChange={onMasterVolumeChange}
        soundFiles={props.soundboard}
        onSoundFilesChange={(files) => {
          // When files change, we need to:
          // 1. Remove files that are no longer in the list
          const removedFiles = props.soundboard.filter(
            oldFile => !files.find(newFile => newFile.id === oldFile.id)
          );
          removedFiles.forEach(file => onSoundRemove(file.id));

          // 2. Add new files
          const newFiles = files.filter(
            newFile => !props.soundboard.find(oldFile => oldFile.id === newFile.id)
          );
          newFiles.forEach(file => onSoundAdd(file));
        }}
      />
      <main className="main-content">
        {activeEnvironment ? (
          <div>
            <h1>{activeEnvironment.name}</h1>
            {/* Environment editor will go here */}
          </div>
        ) : (
          <div className="welcome-screen">
            <h1>Welcome to Orpheus</h1>
            <p>Select an environment or create a new one to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MainLayout; 