import React, { useState } from 'react';
import { Environment, EnvironmentPreset, Layer } from './types/audio';
import { Box, CssBaseline, ThemeProvider, createTheme, Grid } from '@mui/material';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import { generateId } from './utils/ids';

// Create a sample environment for testing
const sampleEnvironment: Environment = {
  id: '1',
  name: 'Test Environment',
  layers: [
    {
      id: 'layer1',
      name: 'Background Music',
      soundFile: {
        id: 'sound1',
        name: 'Background Track',
        path: '/sounds/background.mp3',
        volume: 1,
        lengthMs: 60000
      },
      chance: 1,
      cooldownMs: 0,
      volume: 0.8,
      loopLengthMs: 60000,
      weight: 1
    },
    {
      id: 'layer2',
      name: 'Ambient Effects',
      soundFile: {
        id: 'sound2',
        name: 'Ambient Track',
        path: '/sounds/ambient.mp3',
        volume: 1,
        lengthMs: 30000
      },
      chance: 0.5,
      cooldownMs: 5000,
      volume: 0.6,
      loopLengthMs: 30000,
      weight: 0.5
    }
  ],
  soundboard: [],
  presets: [],
  maxWeight: 2
};

const theme = createTheme({
  // You can customize your theme here
});

const App: React.FC = () => {
  const [environments, setEnvironments] = useState<Environment[]>([sampleEnvironment]);
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(sampleEnvironment);
  const [showConfig, setShowConfig] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);

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
      soundFile: {
        id: generateId(),
        name: 'New Sound',
        path: '',
        volume: 1,
        lengthMs: 0
      },
      chance: 1,
      cooldownMs: 0,
      volume: 0.8,
      loopLengthMs: 0,
      weight: 0
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