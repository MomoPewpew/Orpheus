import React from 'react';
import { Environment, SoundFile } from '../types/audio';
import Sidebar from './Sidebar';
import '../styles/AppLayout.css';

interface MainLayoutProps {
  children: React.ReactNode;
  environments: Environment[];
  activeEnvironment: Environment | null;
  onEnvironmentSelect: (environment: Environment) => void;
  onNewEnvironment: () => void;
  onToggleConfig: () => void;
  onToggleSoundboard: () => void;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  soundFiles: SoundFile[];
  onSoundFilesChange: (files: SoundFile[]) => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  environments,
  activeEnvironment,
  onEnvironmentSelect,
  onNewEnvironment,
  onToggleConfig,
  onToggleSoundboard,
  masterVolume,
  onMasterVolumeChange,
  soundFiles,
  onSoundFilesChange,
}) => {
  return (
    <div className="app-layout">
      <Sidebar
        environments={environments}
        activeEnvironment={activeEnvironment}
        onEnvironmentSelect={onEnvironmentSelect}
        onNewEnvironment={onNewEnvironment}
        onToggleConfig={onToggleConfig}
        onToggleSoundboard={onToggleSoundboard}
        masterVolume={masterVolume}
        onMasterVolumeChange={onMasterVolumeChange}
        soundFiles={soundFiles}
        onSoundFilesChange={onSoundFilesChange}
      />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default MainLayout; 