import React, { useState, useEffect, useCallback } from 'react';
import { Environment, EnvironmentPreset, Layer, LayerSound, SoundFile } from './types/audio';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import ConfigOverlay from './components/overlays/ConfigOverlay';
import { generateId } from './utils/ids';
import { saveWorkspace, loadWorkspace } from './services/workspaceService';
import { listFiles } from './services/fileService';

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
  const [masterVolume, setMasterVolume] = useState<number>(1);

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
        if (typeof workspace.masterVolume === 'number') {
          setMasterVolume(workspace.masterVolume);
        }
        // Set first environment as active if we have any
        if (workspace.environments.length > 0) {
          setActiveEnvironment(workspace.environments[0]);
        }
      })
      .catch((error) => {
        console.error('Failed to load workspace or files:', error);
        // Set default values when loading fails
        setEnvironments([]);
        setSoundFiles([]);
        setMasterVolume(1);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (isLoading) return;

    const state = {
      environments,
      files: soundFiles,
      masterVolume
    };

    console.debug('Saving state:', state);
    saveWorkspace(state).catch((error) => {
      console.error('Failed to save workspace:', error);
    });
  }, [environments, soundFiles, masterVolume, isLoading]);

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

  const handleEnvironmentRemove = (environmentId: string) => {
    setEnvironments(prevEnvironments => prevEnvironments.filter(env => env.id !== environmentId));
    setActiveEnvironment(null);
  };

  const handleLayerAdd = (layer: Layer) => {
    if (!activeEnvironment) return;

    const updatedEnvironment = {
      ...activeEnvironment,
      layers: [...activeEnvironment.layers, layer]
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

  const handlePresetCreate = (preset: EnvironmentPreset) => {
    if (!activeEnvironment) return;

    const updatedEnvironment = {
      ...activeEnvironment,
      presets: [...activeEnvironment.presets, preset]
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetSelect = (presetId: string | undefined) => {
    if (!activeEnvironment) return;

    const updatedEnvironment = {
      ...activeEnvironment,
      defaultPresetId: presetId
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handleMasterVolumeChange = (volume: number) => {
    console.debug('Master volume change requested:', {
      newVolume: volume,
      currentVolume: masterVolume,
      type: typeof volume
    });
    // Ensure volume is a valid number between 0 and 1
    const validVolume = Math.max(0, Math.min(1, Number(volume)));
    setMasterVolume(validVolume);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'environment') {
      const reorderedEnvironments = Array.from(environments);
      const [removed] = reorderedEnvironments.splice(source.index, 1);
      reorderedEnvironments.splice(destination.index, 0, removed);
      setEnvironments(reorderedEnvironments);
    } else if (type === 'layer' && activeEnvironment) {
      const reorderedLayers = Array.from(activeEnvironment.layers);
      const [removed] = reorderedLayers.splice(source.index, 1);
      reorderedLayers.splice(destination.index, 0, removed);
      
      const updatedEnvironment = {
        ...activeEnvironment,
        layers: reorderedLayers
      };
      handleEnvironmentUpdate(updatedEnvironment);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>; // You might want to show a proper loading spinner
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DragDropContext onDragEnd={handleDragEnd}>
        <Box 
          sx={{ 
            display: 'flex', 
            height: '100vh',
            position: 'relative', // Add this to ensure proper stacking context
            overflow: 'hidden' // Prevent any potential scrolling issues
          }}
        >
          <Sidebar
            environments={environments}
            activeEnvironment={activeEnvironment}
            onNewEnvironment={handleNewEnvironment}
            onToggleConfig={handleToggleConfig}
            onToggleSoundboard={handleToggleSoundboard}
            onEnvironmentSelect={handleEnvironmentSelect}
            masterVolume={masterVolume}
            onMasterVolumeChange={handleMasterVolumeChange}
            soundFiles={soundFiles}
            onSoundFilesChange={setSoundFiles}
          />
          <Box 
            component="main" 
            sx={{ 
              flexGrow: 1, 
              height: '100vh', 
              overflow: 'auto',
              position: 'relative' // Add this to ensure proper stacking context
            }}
          >
            <MainContent
              environment={activeEnvironment}
              showSoundboard={showSoundboard}
              soundFiles={soundFiles}
              onEnvironmentUpdate={handleEnvironmentUpdate}
              onEnvironmentRemove={handleEnvironmentRemove}
              onLayerAdd={handleLayerAdd}
              onLayerUpdate={handleLayerUpdate}
              onPresetCreate={handlePresetCreate}
              onPresetSelect={handlePresetSelect}
              onSoundFilesChange={setSoundFiles}
            />
          </Box>
        </Box>
      </DragDropContext>
    </ThemeProvider>
  );
};

export default App; 