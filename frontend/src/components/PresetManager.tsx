import React, { useState } from 'react';
import { 
  Typography, 
  FormControl, 
  InputLabel, 
  Input,
  Select,
  MenuItem,
  Button,
  IconButton,
  Box,
  TextField,
  Stack
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import { EnvironmentPreset, LayerPresetOverrides, Environment, getLayerVolume } from '../types/audio';
import { generateId } from '../utils/ids';

interface PresetManagerProps {
  environment: Environment;
  presets: EnvironmentPreset[];
  onPresetAdd: (preset: EnvironmentPreset) => void;
  onPresetChange: (preset: EnvironmentPreset) => void;
  onPresetDelete: (presetId: string) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  environment,
  presets,
  onPresetAdd,
  onPresetChange,
  onPresetDelete
}) => {
  const [selectedPreset, setSelectedPreset] = useState<EnvironmentPreset | null>(null);

  const handlePresetSelect = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    setSelectedPreset(preset || null);
  };

  const handlePresetNameChange = (name: string) => {
    if (!selectedPreset) return;

    const newPreset = {
      ...selectedPreset,
      name
    };
    setSelectedPreset(newPreset);
    onPresetChange(newPreset);
  };

  const handleLayerOverrideChange = (layerId: string, field: keyof LayerPresetOverrides, value: number) => {
    if (!selectedPreset) return;

    const newPreset = { ...selectedPreset };
    newPreset.layerOverrides = { ...newPreset.layerOverrides };
    
    if (!newPreset.layerOverrides[layerId]) {
      newPreset.layerOverrides[layerId] = {};
    }
    
    newPreset.layerOverrides[layerId] = {
      ...newPreset.layerOverrides[layerId],
      [field]: value
    };

    setSelectedPreset(newPreset);
    onPresetChange(newPreset);
  };

  const handleAddPreset = () => {
    if (!environment) return;
    
    const newPreset: EnvironmentPreset = {
      id: generateId(),
      name: 'New Preset',
      environmentId: environment.id,
      layerOverrides: {}
    };

    onPresetAdd(newPreset);
    setSelectedPreset(newPreset);
  };

  const handleDeletePreset = () => {
    if (!selectedPreset) return;
    onPresetDelete(selectedPreset.id);
    setSelectedPreset(null);
  };

  const renderLayerOverrides = () => {
    if (!environment || !selectedPreset) return null;

    return environment.layers.map(layer => {
      const override = selectedPreset.layerOverrides[layer.id] || {};
      
      return (
        <div key={layer.id} className="layer-override">
          <Typography variant="subtitle2">{layer.name}</Typography>
          <Stack direction="row" spacing={2} sx={{ mt: 1, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Chance</InputLabel>
              <Input
                type="number"
                value={override.chance ?? layer.chance}
                onChange={(e) => handleLayerOverrideChange(layer.id, 'chance', parseFloat(e.target.value))}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
              />
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Volume</InputLabel>
              <Input
                type="number"
                value={override.volume ?? getLayerVolume(layer)}
                onChange={(e) => handleLayerOverrideChange(layer.id, 'volume', parseFloat(e.target.value))}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
              />
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Weight</InputLabel>
              <Input
                type="number"
                value={override.weight ?? layer.weight}
                onChange={(e) => handleLayerOverrideChange(layer.id, 'weight', parseFloat(e.target.value))}
                inputProps={{ min: 0, step: 0.1 }}
              />
            </FormControl>
          </Stack>
        </div>
      );
    });
  };

  return (
    <Box className="preset-manager" sx={{ p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Select Preset</InputLabel>
          <Select
            value={selectedPreset?.id || ''}
            onChange={(e) => handlePresetSelect(e.target.value as string)}
            label="Select Preset"
          >
            {presets.map(preset => (
              <MenuItem key={preset.id} value={preset.id}>
                {preset.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddPreset}
        >
          Add Preset
        </Button>

        {selectedPreset && (
          <>
            <TextField
              label="Preset Name"
              value={selectedPreset.name}
              onChange={(e) => handlePresetNameChange(e.target.value)}
              size="small"
            />
            <IconButton
              color="error"
              onClick={handleDeletePreset}
              aria-label="delete preset"
            >
              <DeleteIcon />
            </IconButton>
          </>
        )}
      </Stack>

      {selectedPreset && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Layer Overrides</Typography>
          {renderLayerOverrides()}
        </Box>
      )}
    </Box>
  );
}; 