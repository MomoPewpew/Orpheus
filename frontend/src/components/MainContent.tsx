import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Button,
  TextField,
  Slider,
  Stack,
  Drawer,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Environment, Layer, EnvironmentPreset, SoundFile, setLayerVolume, getLayerVolume } from '../types/audio';
import { generateId } from '../utils/ids';
import { LayerControls } from './layers/LayerControls';

interface MainContentProps {
  environment: Environment | null;
  showConfig: boolean;
  showSoundboard: boolean;
  soundFiles: SoundFile[];
  onEnvironmentUpdate: (environment: Environment) => void;
  onLayerAdd: () => void;
  onLayerUpdate: (layer: Layer) => void;
  onPresetCreate: (name: string, basePresetId?: string) => void;
  onPresetSelect: (presetId: string) => void;
}

const DRAWER_WIDTH = 300;

export const MainContent: React.FC<MainContentProps> = ({
  environment,
  showConfig,
  showSoundboard,
  soundFiles,
  onEnvironmentUpdate,
  onLayerAdd,
  onLayerUpdate,
  onPresetCreate,
  onPresetSelect,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);

  if (!environment) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h5">Select an environment to begin</Typography>
      </Box>
    );
  }

  const handlePresetChange = (event: React.SyntheticEvent, newValue: number) => {
    setSelectedPresetIndex(newValue);
    const selectedPreset = environment.presets[newValue];
    if (selectedPreset) {
      onPresetSelect(selectedPreset.id);
    }
  };

  const handleMaxWeightChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!environment) return;
    const newMaxWeight = parseFloat(event.target.value);
    onEnvironmentUpdate({
      ...environment,
      maxWeight: newMaxWeight
    });
  };

  const handleLayerPropertyChange = (layer: Layer, property: keyof Layer | 'volume', value: number) => {
    if (property === 'volume') {
      onLayerUpdate(setLayerVolume(layer, value));
    } else if (property in layer) {
      onLayerUpdate({
        ...layer,
        [property]: value
      });
    }
  };

  const handleAddPreset = () => {
    const basePreset = environment.presets[selectedPresetIndex];
    onPresetCreate('New Preset', basePreset?.id);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Environment Banner */}
      <Paper 
        elevation={0}
        sx={{ 
          mb: 3, 
          bgcolor: 'transparent',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 500 }}>{environment.name}</Typography>
        </Box>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 3,
          px: 2,
          pb: 2
        }}>
          <TextField
            type="number"
            value={environment.maxWeight}
            onChange={(e) => {
              const value = parseFloat(e.target.value);
              if (!isNaN(value) && value >= 0) {
                onEnvironmentUpdate({
                  ...environment,
                  maxWeight: value
                });
              }
            }}
            size="small"
            sx={{ width: 150 }}
            inputProps={{ min: 0, step: 0.1 }}
          />
          {/* Add other environment-specific configs here */}
        </Box>
      </Paper>

      {/* Layer Management */}
      <Box>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Tabs 
            value={selectedPresetIndex}
            onChange={handlePresetChange}
            sx={{ 
              minHeight: 'unset',
              '& .MuiTabs-flexContainer': {
                gap: 1,
              },
            }}
          >
            {environment.presets.map((preset) => (
              <Tab 
                key={preset.id} 
                label={preset.name}
                sx={{ 
                  textTransform: 'none',
                  minHeight: 'unset',
                  padding: '8px 16px',
                }}
              />
            ))}
          </Tabs>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddPreset}
            sx={{
              color: '#1976d2',
              '&:hover': {
                bgcolor: 'rgba(25, 118, 210, 0.04)',
              },
            }}
          >
            ADD PRESET
          </Button>
        </Box>

        {/* Layer List */}
        <Stack spacing={1}>
          {/* Header row */}
          <Box sx={{ 
            display: 'grid', 
            gridTemplateColumns: '2fr repeat(3, 1fr)',
            gap: 2,
            px: 2,
            py: 1,
          }}>
            <Typography variant="caption" color="textSecondary">Layer Name</Typography>
            <Typography variant="caption" color="textSecondary">Chance</Typography>
            <Typography variant="caption" color="textSecondary">Volume</Typography>
            <Typography variant="caption" color="textSecondary">Weight</Typography>
          </Box>

          {environment.layers.map((layer) => (
            <LayerControls
              key={layer.id}
              layer={layer}
              soundFiles={soundFiles}
              onLayerChange={(updatedLayer) => onLayerUpdate(updatedLayer)}
            />
          ))}
          
          <Button
            startIcon={<AddIcon />}
            onClick={onLayerAdd}
            sx={{
              alignSelf: 'flex-start',
              color: '#1976d2',
              '&:hover': {
                bgcolor: 'rgba(25, 118, 210, 0.04)',
              },
            }}
          >
            ADD LAYER
          </Button>
        </Stack>
      </Box>

      {/* Config Drawer */}
      {showConfig && (
        <Drawer
          anchor="right"
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              p: 2,
              position: 'absolute'
            },
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Global Configuration</Typography>
          {/* Add global config controls here */}
        </Drawer>
      )}

      {/* Soundboard Drawer */}
      {showSoundboard && (
        <Drawer
          anchor="right"
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              p: 2,
              position: 'absolute'
            },
          }}
        >
          <Typography variant="h6" sx={{ mb: 2 }}>Soundboard</Typography>
          {/* Add soundboard content here */}
        </Drawer>
      )}
    </Box>
  );
};

export default MainContent; 