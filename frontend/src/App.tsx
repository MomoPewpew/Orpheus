import React, { useState, useEffect, useCallback } from 'react';
import { Environment, EnvironmentPreset, Layer, LayerSound, SoundFile } from './types/audio';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { generateId } from './utils/ids';
import { saveWorkspace, loadWorkspace } from './services/workspaceService';
import { listFiles } from './services/fileService';
import debounce from 'lodash/debounce';

const theme = createTheme({
  // You can customize your theme here
});

const App: React.FC = () => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [soundFiles, setSoundFiles] = useState<SoundFile[]>([]);
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [masterVolume, setMasterVolume] = useState(1);

  // Create a debounced save function
  const debouncedSave = useCallback(
    debounce((state: { environments: Environment[]; files: SoundFile[]; masterVolume: number }) => {
      console.debug('Saving workspace state:', state);
      saveWorkspace(state).catch((error) => {
        console.error('Failed to save workspace:', error);
      });
    }, 1000),
    [] // Empty dependency array since we don't want to recreate the debounced function
  );

  // Load initial workspace and sound files
  useEffect(() => {
    Promise.all([
      loadWorkspace(),
      listFiles()
    ])
      .then(([workspace, files]) => {
        console.debug('Loaded workspace:', workspace);
        console.debug('Loaded sound files:', files);
        setEnvironments(workspace.environments);
        setSoundFiles(files);
        setMasterVolume(workspace.masterVolume);
        // Set first environment as active if we have any
        if (workspace.environments.length > 0) {
          setActiveEnvironment(workspace.environments[0]);
        }
      })
      .catch((error) => {
        console.error('Failed to load workspace or files:', error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Save workspace whenever relevant state changes
  useEffect(() => {
    if (!isLoading) {
      const state = {
        environments,
        files: soundFiles,
        masterVolume
      };
      console.debug('State changed, triggering save:', state);
      debouncedSave(state);
    }
  }, [environments, soundFiles, masterVolume, isLoading, debouncedSave]);

  const handleNewEnvironment = () => {
    const newEnvironment: Environment = {
      id: generateId(),
      name: 'New Environment',
      layers: [],
      soundboard: [],
      presets: [],
      maxWeight: 2
    };

    setEnvironments(prevEnvironments => [...prevEnvironments, newEnvironment]);
    setActiveEnvironment(newEnvironment);
  };

  const handleEnvironmentSelect = (env: Environment) => {
    setActiveEnvironment(env);
  };

  const handleToggleConfig = () => {
    setShowConfig(!showConfig);
  };

  const handleToggleSoundboard = () => {
    setShowSoundboard(!showSoundboard);
  };

  const handleEnvironmentUpdate = (updatedEnvironment: Environment) => {
    setEnvironments(prevEnvironments => 
      prevEnvironments.map(env => 
        env.id === updatedEnvironment.id ? updatedEnvironment : env
      )
    );
    setActiveEnvironment(updatedEnvironment);
  };

  const handleLayerAdd = () => {
    if (!activeEnvironment) return;

    const newLayer: Layer = {
      id: generateId(),
      name: 'New Layer',
      sounds: [],
      chance: 1,
      cooldownMs: 0,
      loopLengthMs: 0,
      weight: 1,
      volume: 1
    };

    const updatedEnvironment = {
      ...activeEnvironment,
      layers: [...activeEnvironment.layers, newLayer]
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handleLayerUpdate = (updatedLayer: Layer) => {
    if (!activeEnvironment) return;

    const updatedEnvironment = {
      ...activeEnvironment,
      layers: activeEnvironment.layers.map(layer =>
        layer.id === updatedLayer.id ? updatedLayer : layer
      )
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetCreate = (name: string, basePresetId?: string) => {
    if (!activeEnvironment) return;

    let layerOverrides = {};
    
    if (basePresetId) {
      const basePreset = activeEnvironment.presets.find(p => p.id === basePresetId);
      if (basePreset) {
        layerOverrides = { ...basePreset.layerOverrides };
      }
    }

    const newPreset: EnvironmentPreset = {
      id: generateId(),
      name,
      environmentId: activeEnvironment.id,
      layerOverrides
    };

    const updatedEnvironment = {
      ...activeEnvironment,
      presets: [...activeEnvironment.presets, newPreset]
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetSelect = (presetId: string) => {
    // TODO: Implement preset selection logic
    // This might involve applying the preset's overrides to the layers
    console.log('Selected preset:', presetId);
  };

  if (isLoading) {
    return <div>Loading...</div>; // You might want to show a proper loading spinner
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', height: '100vh' }}>
        <Sidebar
          environments={environments}
          activeEnvironment={activeEnvironment}
          onNewEnvironment={handleNewEnvironment}
          onToggleConfig={handleToggleConfig}
          onToggleSoundboard={handleToggleSoundboard}
          onEnvironmentSelect={handleEnvironmentSelect}
        />
        <Box component="main" sx={{ flexGrow: 1, height: '100vh', overflow: 'auto' }}>
          <MainContent
            environment={activeEnvironment}
            showConfig={showConfig}
            showSoundboard={showSoundboard}
            soundFiles={soundFiles}
            onEnvironmentUpdate={handleEnvironmentUpdate}
            onLayerAdd={handleLayerAdd}
            onLayerUpdate={handleLayerUpdate}
            onPresetCreate={handlePresetCreate}
            onPresetSelect={handlePresetSelect}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default App; 