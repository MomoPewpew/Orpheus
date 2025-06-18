import React, { useState, useEffect } from 'react';
import { Environment, Layer, SoundFile, Preset, PresetLayer, PresetSound, Effects, PlayState } from './types/audio';
import { Box, CssBaseline, ThemeProvider, createTheme, Typography } from '@mui/material';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import ConfigOverlay from './components/overlays/ConfigOverlay';
import { SoundboardOverlay } from './components/overlays/SoundboardOverlay';
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
  const [effects, setEffects] = useState<Effects>({
    normalize: { enabled: true },
    fades: { fadeInDuration: 4000, crossfadeDuration: 4000 },
    filters: {
      highPass: { frequency: 0 },
      lowPass: { frequency: 20000 },
      dampenSpeechRange: { amount: 0 }
    },
    compressor: {
      lowThreshold: -40,
      highThreshold: 0,
      ratio: 1
    }
  });

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
        if (workspace.effects) {
          setEffects(workspace.effects);
        }
        
        // Set active environment: first playing one, or first one if none playing
        if (workspace.environments.length > 0) {
          const playingEnv = workspace.environments.find(env => env.playState === PlayState.Playing);
          setActiveEnvironment(playingEnv || workspace.environments[0]);
        }
      })
      .catch((error) => {
        console.error('Failed to load workspace or files:', error);
        // Set default values when loading fails
        setEnvironments([]);
        setSoundFiles([]);
        setGlobalSoundboard([]);
        setMasterVolume(1);
        setEffects({
          normalize: { enabled: true },
          fades: { fadeInDuration: 4000, crossfadeDuration: 4000 },
          filters: {
            highPass: { frequency: 0 },
            lowPass: { frequency: 20000 },
            dampenSpeechRange: { amount: 0 }
          },
          compressor: {
            lowThreshold: -40,
            highThreshold: 0,
            ratio: 1
          }
        });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  // Save state whenever it changes
  useEffect(() => {
    if (isLoading) return;

    console.debug('State change detected:', {
      hasEffects: !!effects,
      effectsKeys: Object.keys(effects),
      fullEffects: effects
    });

    const state = {
      environments,
      files: soundFiles,
      soundboard: globalSoundboard,
      masterVolume,
      effects,
    };

    console.debug('Saving state:', state);
    saveWorkspace(state).catch((error) => {
      console.error('Failed to save workspace:', error);
    });
  }, [environments, soundFiles, globalSoundboard, masterVolume, effects, isLoading]);

  const handleNewEnvironment = () => {
    const newEnvironment: Environment = {
      id: generateId(),
      name: 'New Environment',
      layers: [],
      soundboard: [],
      presets: [],
      maxWeight: 2,
      playState: PlayState.Stopped,
      activePresetId: undefined
    };

    setEnvironments((prevEnvironments: Environment[]) => [...prevEnvironments, newEnvironment]);
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

    // Check if we're updating a non-preset property (mode, name, loopLengthMs, sounds, or selectedSoundIndex)
    const isNonPresetUpdate = 
      updatedLayer.mode !== originalLayer.mode ||
      updatedLayer.name !== originalLayer.name ||
      updatedLayer.loopLengthMs !== originalLayer.loopLengthMs ||
      updatedLayer.sounds.length !== originalLayer.sounds.length ||
      updatedLayer.selectedSoundIndex !== originalLayer.selectedSoundIndex; // Track changes to selectedSoundIndex

    if (isNonPresetUpdate) {
      // For non-preset properties, update the base layer directly
      const updatedEnvironment = {
        ...activeEnvironment,
        layers: activeEnvironment.layers.map((l: Layer) =>
          l.id === updatedLayer.id ? {
            ...l,
            mode: updatedLayer.mode,
            name: updatedLayer.name,
            loopLengthMs: updatedLayer.loopLengthMs,
            selectedSoundIndex: updatedLayer.selectedSoundIndex,
            sounds: updatedLayer.sounds
          } : l
        )
      };
      handleEnvironmentUpdate(updatedEnvironment);
      return; // Exit early, don't handle preset properties
    }

    // If we get here, we're handling preset-managed properties
    if (activePreset && activePreset.layers) {
      // Always update the base layer's selectedSoundIndex if it changed
      if (updatedLayer.selectedSoundIndex !== originalLayer.selectedSoundIndex) {
        const updatedEnvironment = {
          ...activeEnvironment,
          layers: activeEnvironment.layers.map((l: Layer) =>
            l.id === updatedLayer.id ? {
              ...l,
              selectedSoundIndex: updatedLayer.selectedSoundIndex
            } : l
          )
        };
        handleEnvironmentUpdate(updatedEnvironment);
      }

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
          l.id === updatedLayer.id ? {
            ...l,
            ...updatedLayer  // This ensures all properties are copied, including selectedSoundIndex
          } : l
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

  const handleEffectsUpdate = (newEffects: Effects) => {
    console.debug('Updating effects:', {
      oldEffects: effects,
      newEffects: newEffects
    });
    setEffects(newEffects);
  };

  const handlePlayStop = async () => {
    if (!activeEnvironment) return;

    const newPlayState = activeEnvironment.playState === PlayState.Playing 
      ? PlayState.Stopped 
      : PlayState.Playing;

    // Create updated environments array, ensuring only one environment is playing
    const updatedEnvironments = environments.map((env: Environment) => ({
      ...env,
      // If this is the active environment, use its new state
      // Otherwise, if we're starting to play, force all others to stop
      playState: env.id === activeEnvironment.id 
        ? newPlayState 
        : (newPlayState === PlayState.Playing ? PlayState.Stopped : env.playState)
    }));

    // Create updated environment with new play state
    const updatedEnvironment = updatedEnvironments.find(env => env.id === activeEnvironment.id)!;

    try {
      // First try to save the state
      await saveWorkspace({
        environments: updatedEnvironments,
        files: soundFiles,
        soundboard: globalSoundboard,
        masterVolume,
        effects,
      });

      // Only update state if save was successful
      setEnvironments(updatedEnvironments);
      setActiveEnvironment(updatedEnvironment);
    } catch (error: unknown) {
      // Try to parse error message from JSON if possible
      let message = 'Failed to update playback state';
      if (error instanceof Error) {
        try {
          const errorObj = JSON.parse(error.message);
          message = errorObj.error || message;
        } catch {
          message = error.message || message;
        }
      }
      
      // Show simple alert
      window.alert(message);
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
                onPlayStop={handlePlayStop}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography>Select an environment to begin</Typography>
              </Box>
            )}
            {showSoundboard && (
              <SoundboardOverlay
                environment={activeEnvironment || { 
                  id: '', 
                  name: '', 
                  layers: [], 
                  soundboard: [], 
                  presets: [], 
                  maxWeight: 2,
                  playState: PlayState.Stopped 
                }}
                onClose={handleToggleSoundboard}
                soundFiles={soundFiles}
                globalSoundboard={globalSoundboard}
                onSoundFilesChange={setSoundFiles}
                onEnvironmentUpdate={handleEnvironmentUpdate}
                onGlobalSoundboardChange={setGlobalSoundboard}
              />
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
            onEffectsUpdate={handleEffectsUpdate}
            onGlobalSoundboardUpdate={setGlobalSoundboard}
            globalSoundboard={globalSoundboard}
            effects={effects}
          />
        </Box>
      </DragDropContext>
    </ThemeProvider>
  );
};

export default App; 