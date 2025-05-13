import React, { useState, useEffect, useCallback } from 'react';
import { Environment, Layer, LayerSound, SoundFile, Preset, PresetLayer, PresetSound } from './types/audio';
import { Box, CssBaseline, ThemeProvider, createTheme, Typography } from '@mui/material';
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
  const [globalSoundboard, setGlobalSoundboard] = useState<string[]>([]);

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
        setGlobalSoundboard(workspace.soundboard || []);
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
        setGlobalSoundboard([]);
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
      soundboard: globalSoundboard,
      masterVolume
    };

    console.debug('Saving state:', state);
    saveWorkspace(state).catch((error) => {
      console.error('Failed to save workspace:', error);
    });
  }, [environments, soundFiles, globalSoundboard, masterVolume, isLoading]);

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
    setEnvironments((prevEnvironments: Environment[]) => 
      prevEnvironments.map((env: Environment) => 
        env.id === updatedEnvironment.id ? updatedEnvironment : env
      )
    );
    setActiveEnvironment(updatedEnvironment);
  };

  const handleEnvironmentRemove = (environmentId: string) => {
    setEnvironments((prevEnvironments: Environment[]) => 
      prevEnvironments.filter((env: Environment) => env.id !== environmentId)
    );
    setActiveEnvironment(null);
  };

  const handleLayerAdd = (layer: Layer) => {
    if (!activeEnvironment) return;

    // Ensure each sound has an ID
    const layerWithSoundIds = {
      ...layer,
      sounds: layer.sounds.map(sound => ({
        ...sound,
        id: generateId()
      }))
    };

    const updatedEnvironment: Environment = {
      ...activeEnvironment,
      layers: [...activeEnvironment.layers, layerWithSoundIds]
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handleLayerUpdate = (updatedLayer: Layer) => {
    if (!activeEnvironment || !activeEnvironment.layers) return;

    const originalLayer = activeEnvironment.layers.find((l: Layer) => l.id === updatedLayer.id);
    if (!originalLayer) return;

    const activePreset = activeEnvironment.activePresetId 
      ? activeEnvironment.presets?.find((p: Preset) => p.id === activeEnvironment.activePresetId)
      : undefined;

    // Check if we're updating a non-preset property (mode, name, or loopLengthMs)
    const isNonPresetUpdate = 
      updatedLayer.mode !== originalLayer.mode ||
      updatedLayer.name !== originalLayer.name ||
      updatedLayer.loopLengthMs !== originalLayer.loopLengthMs;

    if (isNonPresetUpdate) {
      // For non-preset properties, update the base layer directly
      const updatedEnvironment = {
        ...activeEnvironment,
        layers: activeEnvironment.layers.map((l: Layer) =>
          l.id === updatedLayer.id ? {
            ...l,
            mode: updatedLayer.mode,
            name: updatedLayer.name,
            loopLengthMs: updatedLayer.loopLengthMs
          } : l
        )
      };
      handleEnvironmentUpdate(updatedEnvironment);
      return; // Exit early, don't handle preset properties
    }

    // If we get here, we're handling preset-managed properties
    if (activePreset && activePreset.layers) {
      // Update the preset with the changes for preset-managed properties only
      const presetLayer = activePreset.layers.find((p: PresetLayer) => p.id === updatedLayer.id) || { 
        id: updatedLayer.id 
      };
      const updatedPresetLayer = { ...presetLayer };

      // Compare each preset-managed property and only store changes
      if (updatedLayer.volume !== originalLayer.volume) {
        updatedPresetLayer.volume = updatedLayer.volume;
      }
      if (updatedLayer.weight !== originalLayer.weight) {
        updatedPresetLayer.weight = updatedLayer.weight;
      }
      if (updatedLayer.chance !== originalLayer.chance) {
        updatedPresetLayer.chance = updatedLayer.chance;
      }
      if (updatedLayer.cooldownCycles !== originalLayer.cooldownCycles) {
        updatedPresetLayer.cooldownCycles = updatedLayer.cooldownCycles;
      }

      // Compare sound properties
      const updatedPresetSounds = updatedLayer.sounds.map((sound, index) => {
        const originalSound = originalLayer.sounds[index];
        if (!originalSound) return null;

        // Always include required properties
        const changes: PresetSound = {
          id: sound.id,
          fileId: sound.fileId,
          volume: sound.volume !== originalSound.volume ? sound.volume : undefined,
          frequency: sound.frequency !== originalSound.frequency ? sound.frequency : undefined
        };

        // Only update if there are actual changes
        const hasChanges = 
          sound.volume !== originalSound.volume ||
          sound.frequency !== originalSound.frequency;

        return hasChanges ? changes : null;
      }).filter((sound): sound is PresetSound => sound !== null);

      if (updatedPresetSounds.length > 0) {
        updatedPresetLayer.sounds = updatedPresetSounds;
      }

      // Update the preset if we have any changes
      if (Object.keys(updatedPresetLayer).length > 1) { // More than just id
        const updatedPreset = {
          ...activePreset,
          layers: [
            ...(activePreset.layers || []).filter((p: PresetLayer) => p.id !== updatedLayer.id),
            updatedPresetLayer
          ]
        };

        handlePresetUpdate(updatedPreset);
      }
    } else {
      // No preset active, update the base layer directly
      const updatedEnvironment = {
        ...activeEnvironment,
        layers: activeEnvironment.layers.map((l: Layer) =>
          l.id === updatedLayer.id ? updatedLayer : l
        )
      };
      handleEnvironmentUpdate(updatedEnvironment);
    }
  };

  const handlePresetCreate = (preset: Preset) => {
    if (!activeEnvironment) return;

    const updatedEnvironment = {
      ...activeEnvironment,
      presets: [...activeEnvironment.presets, preset]
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetUpdate = (preset: Preset) => {
    if (!activeEnvironment) return;

    const updatedEnvironment: Environment = {
      ...activeEnvironment,
      presets: activeEnvironment.presets.map((p: Preset) => 
        p.id === preset.id ? preset : p
      )
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetDelete = (presetId: string) => {
    if (!activeEnvironment) return;

    const updatedEnvironment: Environment = {
      ...activeEnvironment,
      presets: activeEnvironment.presets.filter((p: Preset) => p.id !== presetId),
      activePresetId: activeEnvironment.activePresetId === presetId 
        ? undefined 
        : activeEnvironment.activePresetId
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetsReorder = (presets: Preset[]) => {
    if (!activeEnvironment) return;

    const updatedEnvironment: Environment = {
      ...activeEnvironment,
      presets
    };

    handleEnvironmentUpdate(updatedEnvironment);
  };

  const handlePresetSelect = (presetId: string | undefined) => {
    if (!activeEnvironment) return;

    const updatedEnvironment: Environment = {
      ...activeEnvironment,
      activePresetId: presetId
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

    // Handle layer reordering
    if (type === 'layer' && activeEnvironment) {
      const layers = Array.from(activeEnvironment.layers);
      const [removed] = layers.splice(source.index, 1);
      layers.splice(destination.index, 0, removed);
      handleEnvironmentUpdate({
        ...activeEnvironment,
        layers
      });
      return;
    }

    // Handle environment reordering
    if (type === 'environment') {
      const items = Array.from(environments);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      setEnvironments(items);
      return;
    }

    // Handle preset reordering
    if (type === 'preset' && activeEnvironment) {
      const presets = Array.from(activeEnvironment.presets);
      const [reorderedItem] = presets.splice(source.index, 1);
      presets.splice(destination.index, 0, reorderedItem);
      handleEnvironmentUpdate({
        ...activeEnvironment,
        presets
      });
      return;
    }

    // Handle sound reordering
    if (type === 'environment-sound' && activeEnvironment) {
      const items = Array.from(activeEnvironment.soundboard);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      handleEnvironmentUpdate({
        ...activeEnvironment,
        soundboard: items
      });
      return;
    }

    // Handle global sound reordering
    if (type === 'global-sound') {
      const items = Array.from(globalSoundboard);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      setGlobalSoundboard(items);
      return;
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
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {activeEnvironment ? (
              <MainContent
                environment={activeEnvironment}
                showSoundboard={showSoundboard}
                soundFiles={soundFiles}
                globalSoundboard={globalSoundboard}
                onEnvironmentUpdate={handleEnvironmentUpdate}
                onEnvironmentRemove={handleEnvironmentRemove}
                onLayerAdd={handleLayerAdd}
                onLayerUpdate={handleLayerUpdate}
                onPresetCreate={handlePresetCreate}
                onPresetSelect={handlePresetSelect}
                onPresetUpdate={handlePresetUpdate}
                onPresetDelete={handlePresetDelete}
                onPresetsReorder={handlePresetsReorder}
                onSoundFilesChange={setSoundFiles}
                onGlobalSoundboardChange={setGlobalSoundboard}
                onToggleSoundboard={handleToggleSoundboard}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>Select an environment to begin</Typography>
              </Box>
            )}
          </Box>
          <ConfigOverlay
            open={showConfig}
            onClose={handleToggleConfig}
            environments={environments}
            onEnvironmentUpdate={handleEnvironmentUpdate}
            masterVolume={masterVolume}
            onMasterVolumeChange={handleMasterVolumeChange}
            soundFiles={soundFiles}
            onSoundFilesChange={setSoundFiles}
          />
        </Box>
      </DragDropContext>
    </ThemeProvider>
  );
};

export default App; 