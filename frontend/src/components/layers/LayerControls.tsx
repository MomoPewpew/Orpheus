import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  Slider,
  Typography,
  Paper,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { Theme } from '@mui/material/styles';
import {
  Delete,
  Add,
  DragIndicator,
  Settings,
  Shuffle,
  Repeat,
  RadioButtonChecked,
} from '@mui/icons-material';
import { Layer, LayerSound, SoundFile, Preset, PresetLayer, LayerMode, PresetSound } from '../../types/audio';
import AddLayerDialog from '../AddLayerDialog';
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { alpha } from '@mui/material/styles';

export {};

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const API_PLAYING_LAYERS = `${API_BASE}/playing-layers`;

// Custom styled Slider that shows both default and preset values
const DualValueSlider = styled(Slider)(({ theme }) => ({
  position: 'relative',
  '& .MuiSlider-rail': {
    opacity: 0.8,
    backgroundColor: theme.palette.grey[400],
  },
  '& .MuiSlider-track': {
    backgroundColor: theme.palette.primary.main,
    opacity: 0.8,
  },
  '& .MuiSlider-thumb': {
    backgroundColor: theme.palette.background.paper,
    border: `2px solid ${theme.palette.primary.main}`,
    '&:hover, &.Mui-focusVisible': {
      boxShadow: `0px 0px 0px 8px ${alpha(theme.palette.primary.main, 0.16)}`,
    },
  },
  // Show default value mark
  '& .MuiSlider-mark': {
    width: 3,
    height: 16,
    backgroundColor: theme.palette.grey[700],
    opacity: 0.6,
    '&.MuiSlider-markActive': {
      opacity: 0.8,
    },
  },
  // Disabled styles
  '&.Mui-disabled': {
    '& .MuiSlider-rail': {
      backgroundColor: theme.palette.grey[300],
    },
    '& .MuiSlider-track': {
      backgroundColor: theme.palette.grey[400],
      opacity: 0.5,
    },
    '& .MuiSlider-thumb': {
      border: `2px solid ${theme.palette.grey[400]}`,
      '&:hover, &.Mui-focusVisible': {
        boxShadow: 'none',
      },
    },
    '& .MuiSlider-mark': {
      backgroundColor: theme.palette.grey[400],
    },
  },
  // Preset override styles
  '&.preset-active': {
    '& .MuiSlider-track': {
      backgroundColor: theme.palette.secondary.main,
      opacity: 0.8,
    },
    '& .MuiSlider-thumb': {
      backgroundColor: theme.palette.background.paper,
      border: `2px solid ${theme.palette.secondary.main}`,
      '&:hover, &.Mui-focusVisible': {
        boxShadow: `0px 0px 0px 8px ${alpha(theme.palette.secondary.main, 0.16)}`,
      },
    },
    // Show ghost thumb for default value
    '&::before': {
      content: '""',
      position: 'absolute',
      width: 20,
      height: 20,
      borderRadius: '50%',
      backgroundColor: 'transparent',
      border: `2px solid ${theme.palette.grey[400]}`,
      top: '50%',
      transform: 'translate(-50%, -50%)',
      left: 'var(--default-value-left)',
      display: 'var(--default-value-display)',
      pointerEvents: 'none',
      opacity: 0.5,
      zIndex: 1,
    }
  },
}));

// Status light component that shows if the layer is currently playing
const StatusLight = styled('div', {
  shouldForwardProp: (prop: string) => prop !== 'isPlaying'
})<{ isPlaying?: boolean }>(({ theme, isPlaying }: { theme: Theme; isPlaying?: boolean }) => ({
  width: 8,
  height: 8,
  borderRadius: '50%',
  backgroundColor: isPlaying ? theme.palette.success.main : theme.palette.grey[400],
  transition: theme.transitions.create('background-color', {
    duration: theme.transitions.duration.shortest
  }),
  marginRight: theme.spacing(1),
  opacity: isPlaying ? 1 : 0.5,
  boxShadow: isPlaying ? `0 0 6px ${theme.palette.success.main}` : 'none'
}));

interface LayerControlsProps {
  layer: Layer;
  soundFiles: SoundFile[];
  onLayerUpdate: (layer: Layer) => void;
  onLayerEdit: (layer: Layer) => void;
  onLayerRemove: (layerId: string) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  activePreset?: Preset;
  defaultLayer?: Layer; // The layer without preset overrides
  onPresetUpdate: (preset: Preset) => void;
  onSoundFilesChange?: (soundFiles: SoundFile[]) => void;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layer,
  soundFiles = [],
  onLayerUpdate,
  onLayerRemove,
  dragHandleProps,
  activePreset,
  onPresetUpdate,
  onSoundFilesChange,
}) => {
  const sounds = layer.sounds || [];
  const [selectedSoundIndex, setSelectedSoundIndex] = useState(layer.selectedSoundIndex || 0);
  const [isAddingSoundOpen, setIsAddingSoundOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState(layer.name);
  const [newLoopLength, setNewLoopLength] = useState(layer.loopLengthMs);
  const [tempValues, setTempValues] = useState<Record<string, number>>({});
  const [playingLayers, setPlayingLayers] = useState<string[]>([]);

  // Set up polling for playing layers
  useEffect(() => {
    const fetchPlayingLayers = async () => {
      try {
        const response = await fetch(API_PLAYING_LAYERS);
        const data = await response.json();
        setPlayingLayers(data.playing_layers);
      } catch (error) {
        console.error('Failed to fetch playing layers:', error);
      }
    };

    // Initial fetch
    fetchPlayingLayers();

    // Set up polling interval
    const intervalId = setInterval(fetchPlayingLayers, 250);

    // Cleanup on unmount
    return () => clearInterval(intervalId);
  }, []); // Empty dependency array since we want this to run once on mount

  // Get the current effective value for a property (preset value if exists, otherwise layer value)
  const getEffectiveValue = (property: 'volume' | 'weight' | 'chance' | 'frequency' | 'cooldownCycles' | 'mode', soundId?: string): number | LayerMode => {
    // These properties are never managed by presets, always return base layer values
    if (property === 'mode') {
      return layer.mode ?? LayerMode.Shuffle;
    }

    // For preset-managed properties, check preset values
    if (activePreset?.layers) {
      const presetLayer = activePreset.layers.find(p => p.id === layer.id);
      if (soundId && presetLayer?.sounds) {
        // Handle sound-level properties (only volume and frequency)
        const presetSound = presetLayer.sounds.find(s => s.id === soundId);
        if (presetSound && (property === 'volume' || property === 'frequency')) {
          // Only use preset value if it's explicitly set
          if (presetSound[property] !== undefined) {
            return presetSound[property] as number;
          }
        }
      } else if (!soundId && property !== 'frequency') {
        // Handle layer-level properties (volume, weight, chance, cooldownCycles)
        if (presetLayer) {
          // Only use preset value if it's explicitly set
          const value = presetLayer[property as keyof Pick<PresetLayer, 'volume' | 'weight' | 'chance' | 'cooldownCycles'>];
          if (value !== undefined) {
            return value as number;
          }
        }
      }
    }

    // Always fall back to layer's base values
    if (soundId) {
      const sound = layer.sounds.find(s => s.id === soundId);
      if (sound && (property === 'volume' || property === 'frequency')) {
        return sound[property as keyof Pick<LayerSound, 'volume' | 'frequency'>] ?? 1;
      }
      return 1;
    } else {
      if (property === 'frequency') {
        return 1; // Frequency is only valid for sounds, not layers
      }
      // Handle remaining layer properties
      return layer[property as keyof Pick<Layer, 'volume' | 'weight' | 'chance' | 'cooldownCycles'>] ?? (property === 'cooldownCycles' ? 0 : 1);
    }
  };

  // Get the base value for a property (the layer's value without preset overrides)
  const getDefaultValue = (property: string, soundId?: string): number | undefined => {
    if (soundId) {
      // For sound properties, use the current layer's sound value
      const sound = layer.sounds.find(s => s.id === soundId);
      const value = sound?.[property as keyof LayerSound];
      return typeof value === 'number' ? value : undefined;
    }
    
    // For layer properties, use the current layer's value
    const value = layer[property as keyof Layer];
    // Only return numeric values
    return typeof value === 'number' ? value : undefined;
  };

  // Get mark value for sliders (always returns a number)
  const getMarkValue = (property: string, soundId?: string): number => {
    const value = getDefaultValue(property, soundId);
    return typeof value === 'number' ? value : 1;
  };

  // Get numeric value for sliders (handles both number and LayerMode types)
  const getNumericValue = (property: 'volume' | 'weight' | 'chance' | 'frequency' | 'cooldownCycles' | 'mode', soundId?: string): number => {
    const value = getEffectiveValue(property as 'volume' | 'weight' | 'chance' | 'frequency' | 'cooldownCycles', soundId) as number;
    return typeof value === 'number' ? value : 1;
  };

  // Check if a value has a preset override
  const hasPresetOverride = (property: 'volume' | 'weight' | 'chance' | 'frequency' | 'cooldownCycles' | 'mode', soundId?: string): boolean => {
    // These properties are never managed by presets
    if (property === 'mode') {
      return false;
    }

    if (!activePreset?.layers) return false;
    
    const presetLayer = activePreset.layers.find(p => p.id === layer.id);
    if (!presetLayer) return false;

    if (soundId) {
      // Check sound-level override
      const presetSound = presetLayer.sounds?.find(s => s.id === soundId);
      if (!presetSound) return false;
      
      // Check if the preset value is different from the default
      const defaultValue = getDefaultValue(property, soundId);
      if (defaultValue === undefined) return false;
      
      // Only check volume and frequency for sounds
      if (property === 'volume' || property === 'frequency') {
        return presetSound[property] !== undefined && presetSound[property] !== defaultValue;
      }
      return false;
    } else {
      // Check layer-level properties
      if (property === 'volume' || property === 'weight' || property === 'chance' || property === 'cooldownCycles') {
        const defaultValue = getDefaultValue(property);
        if (defaultValue === undefined) return false;
        return presetLayer[property] !== undefined && presetLayer[property] !== defaultValue;
      }
      return false;
    }
  };

  const handleAddSound = (newLayer: Layer) => {
    // Extract the first sound from the new layer and add it to our layer
    if (newLayer.sounds.length > 0) {
      const newIndex = sounds.length;  // The new sound will be added at the end
      const newSound = newLayer.sounds[0];
      
      // Create updated layer with new sound
      const updatedLayer = {
        ...layer,
        sounds: [...sounds, newSound],
        selectedSoundIndex: newIndex,
        // Add non-preset properties to ensure they're preserved
        name: layer.name,
        loopLengthMs: layer.loopLengthMs,
        mode: layer.mode
      };

      // Update through the main layer update handler
      onLayerUpdate(updatedLayer);
      setSelectedSoundIndex(newIndex);
    }
    setIsAddingSoundOpen(false);
  };

  const selectedSound = sounds[selectedSoundIndex] || {
    fileId: '',
    volume: 0.8,
    frequency: 1
  };

  const handleConfigure = () => {
    if (newLayerName.trim()) {
      // Name and loop length are not managed by presets, so always update the base layer directly
      onLayerUpdate({ 
        ...layer, 
        name: newLayerName.trim(),
        loopLengthMs: newLoopLength
      });
      setIsConfigureOpen(false);
    }
  };

  const handleSliderChange = (key: string, value: number) => {
    setTempValues(prev => ({ ...prev, [key]: value }));
  };

  const clearTempValue = (key: string) => {
    setTempValues(prev => {
      const newValues = { ...prev };
      delete newValues[key];
      return newValues;
    });
  };

  const handleLayerVolumeChange = (newValue: number) => {
    clearTempValue('volume');
    // Skip if value hasn't changed
    if (newValue === getEffectiveValue('volume')) {
      return;
    }

    if (activePreset?.layers) {
      // Get the base layer value
      const baseValue = getDefaultValue('volume');
      
      // Handle preset override
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id };
      
      // If the new value matches the base value, remove the volume property
      const updatedPresetLayer = newValue === baseValue
        ? { ...presetLayer, volume: undefined }
        : { ...presetLayer, volume: newValue };

      // Remove the layer entirely if it has no overrides left
      const updatedPreset = {
        ...activePreset,
        layers: activePreset.layers
          .filter(p => p.id !== layer.id)
          .concat([updatedPresetLayer])
          .filter(p => {
            // Keep the layer if it has properties beyond id or has sounds
            const hasOverrides = Object.keys(p).length > 1;
            const hasSounds = p.sounds && p.sounds.length > 0;
            return hasOverrides || hasSounds;
          })
      };
      onPresetUpdate(updatedPreset);
    } else {
      // Update layer directly
      onLayerUpdate({ ...layer, volume: newValue });
    }
  };

  const handleLayerWeightChange = (newValue: number) => {
    clearTempValue('weight');
    // Skip if value hasn't changed
    if (newValue === getEffectiveValue('weight')) {
      return;
    }

    if (activePreset?.layers) {
      // Get the base layer value
      const baseValue = getDefaultValue('weight');
      
      // Handle preset override
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id };
      
      // If the new value matches the base value, remove the weight property
      const updatedPresetLayer = newValue === baseValue
        ? { ...presetLayer, weight: undefined }
        : { ...presetLayer, weight: newValue };

      // Remove the layer entirely if it has no overrides left
      const updatedPreset = {
        ...activePreset,
        layers: activePreset.layers
          .filter(p => p.id !== layer.id)
          .concat([updatedPresetLayer])
          .filter(p => {
            // Keep the layer if it has properties beyond id or has sounds
            const hasOverrides = Object.keys(p).length > 1;
            const hasSounds = p.sounds && p.sounds.length > 0;
            return hasOverrides || hasSounds;
          })
      };
      onPresetUpdate(updatedPreset);
    } else {
      // Update layer directly
      onLayerUpdate({ ...layer, weight: newValue });
    }
  };

  const handleLayerChanceChange = (newValue: number) => {
    clearTempValue('chance');
    // Skip if value hasn't changed
    if (newValue === getEffectiveValue('chance')) {
      return;
    }

    if (activePreset?.layers) {
      // Get the base layer value
      const baseValue = getDefaultValue('chance');
      
      // Handle preset override
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id };
      
      // If the new value matches the base value, remove the chance property
      const updatedPresetLayer = newValue === baseValue
        ? { ...presetLayer, chance: undefined }
        : { ...presetLayer, chance: newValue };

      // Remove the layer entirely if it has no overrides left
      const updatedPreset = {
        ...activePreset,
        layers: activePreset.layers
          .filter(p => p.id !== layer.id)
          .concat([updatedPresetLayer])
          .filter(p => {
            // Keep the layer if it has properties beyond id or has sounds
            const hasOverrides = Object.keys(p).length > 1;
            const hasSounds = p.sounds && p.sounds.length > 0;
            return hasOverrides || hasSounds;
          })
      };
      onPresetUpdate(updatedPreset);
    } else {
      // Update layer directly
      onLayerUpdate({ ...layer, chance: newValue });
    }
  };

  const handleLayerCooldownChange = (newValue: number) => {
    clearTempValue('cooldownCycles');
    // Skip if value hasn't changed
    if (newValue === getEffectiveValue('cooldownCycles')) {
      return;
    }

    if (activePreset?.layers) {
      // Get the base layer value
      const baseValue = getDefaultValue('cooldownCycles');
      
      // Handle preset override
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id };
      
      // If the new value matches the base value, remove the cooldownCycles property
      const updatedPresetLayer = newValue === baseValue
        ? { ...presetLayer, cooldownCycles: undefined }
        : { ...presetLayer, cooldownCycles: newValue };

      // Remove the layer entirely if it has no overrides left
      const updatedPreset = {
        ...activePreset,
        layers: activePreset.layers
          .filter(p => p.id !== layer.id)
          .concat([updatedPresetLayer])
          .filter(p => {
            // Keep the layer if it has properties beyond id or has sounds
            const hasOverrides = Object.keys(p).length > 1;
            const hasSounds = p.sounds && p.sounds.length > 0;
            return hasOverrides || hasSounds;
          })
      };
      onPresetUpdate(updatedPreset);
    } else {
      // Update layer directly
      onLayerUpdate({ ...layer, cooldownCycles: newValue });
    }
  };

  const handleSoundVolumeChange = (selectedSound: LayerSound, newValue: number) => {
    clearTempValue(`volume-${selectedSound.id}`);
    // Skip if value hasn't changed
    if (newValue === getEffectiveValue('volume', selectedSound.id)) {
      return;
    }

    if (activePreset?.layers) {
      // Get the base sound value
      const baseValue = getDefaultValue('volume', selectedSound.id);
      
      // Handle preset override
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id };
      const existingPresetSound = presetLayer.sounds?.find(s => s.id === selectedSound.id);
      
      // If the new value matches the base value, remove the volume property
      const updatedPresetSound: PresetSound = {
        id: selectedSound.id,
        fileId: selectedSound.fileId,
        ...(existingPresetSound?.frequency !== undefined && { frequency: existingPresetSound.frequency }),
        ...(newValue !== baseValue && { volume: newValue })
      };
      
      // Only include the sound if it has overrides
      const hasOverrides = Object.keys(updatedPresetSound).length > 2; // More than just id and fileId
      
      const updatedPresetSounds = presetLayer.sounds
        ? presetLayer.sounds
            .filter(s => s.id !== selectedSound.id)
            .concat(hasOverrides ? [updatedPresetSound] : [])
        : (hasOverrides ? [updatedPresetSound] : []);

      const updatedPreset = {
        ...activePreset,
        layers: activePreset.layers
          .filter(p => p.id !== layer.id)
          .concat([{ 
            ...presetLayer, 
            sounds: updatedPresetSounds.length > 0 ? updatedPresetSounds : undefined 
          }])
          .filter(p => {
            // Keep the layer if it has properties beyond id or has sounds
            const hasOverrides = Object.keys(p).length > 1;
            const hasSounds = p.sounds && p.sounds.length > 0;
            return hasOverrides || hasSounds;
          })
      };

      onPresetUpdate(updatedPreset);
    } else {
      // Only update the layer directly if we're not in preset mode
      const updatedSound = { ...selectedSound, volume: newValue };
      const updatedSounds = layer.sounds.map(s => s.id === selectedSound.id ? updatedSound : s);
      onLayerUpdate({ ...layer, sounds: updatedSounds });
    }
  };

  const handleSoundFrequencyChange = (selectedSound: LayerSound, newValue: number) => {
    clearTempValue(`frequency-${selectedSound.id}`);
    // Skip if value hasn't changed
    if (newValue === getEffectiveValue('frequency', selectedSound.id)) {
      return;
    }

    if (activePreset?.layers) {
      // Get the base sound value
      const baseValue = getDefaultValue('frequency', selectedSound.id);
      
      // Handle preset override
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id };
      const existingPresetSound = presetLayer.sounds?.find(s => s.id === selectedSound.id);
      
      // If the new value matches the base value, remove the frequency property
      const updatedPresetSound: PresetSound = {
        id: selectedSound.id,
        fileId: selectedSound.fileId,
        ...(existingPresetSound?.volume !== undefined && { volume: existingPresetSound.volume }),
        ...(newValue !== baseValue && { frequency: newValue })
      };
      
      // Only include the sound if it has overrides
      const hasOverrides = Object.keys(updatedPresetSound).length > 2; // More than just id and fileId
      
      const updatedPresetSounds = presetLayer.sounds
        ? presetLayer.sounds
            .filter(s => s.id !== selectedSound.id)
            .concat(hasOverrides ? [updatedPresetSound] : [])
        : (hasOverrides ? [updatedPresetSound] : []);

      const updatedPreset = {
        ...activePreset,
        layers: activePreset.layers
          .filter(p => p.id !== layer.id)
          .concat([{ 
            ...presetLayer, 
            sounds: updatedPresetSounds.length > 0 ? updatedPresetSounds : undefined 
          }])
          .filter(p => {
            // Keep the layer if it has properties beyond id or has sounds
            const hasOverrides = Object.keys(p).length > 1;
            const hasSounds = p.sounds && p.sounds.length > 0;
            return hasOverrides || hasSounds;
          })
      };

      onPresetUpdate(updatedPreset);
    } else {
      // Only update the layer directly if we're not in preset mode
      const updatedSound = { ...selectedSound, frequency: newValue };
      const updatedSounds = layer.sounds.map(s => s.id === selectedSound.id ? updatedSound : s);
      onLayerUpdate({ ...layer, sounds: updatedSounds });
    }
  };

  const handleModeChange = (newMode: LayerMode) => {
    // Mode is not managed by presets, so always update the base layer directly
    onLayerUpdate({ ...layer, mode: newMode });
  };

  // Helper to calculate the left position for the default value ghost thumb
  const getDefaultValueStyle = (defaultValue: number | undefined, min: number, max: number) => {
    // Only show ghost thumb if we have a real default value
    if (defaultValue === undefined) {
      return {
        '--default-value-display': 'none'
      } as React.CSSProperties;
    }
    
    // Calculate the percentage position based on the default value
    const percentage = ((defaultValue - min) / (max - min)) * 100;
    
    return {
      '--default-value-left': `${percentage}%`,
      '--default-value-display': activePreset?.layers ? 'block' : 'none'
    } as React.CSSProperties;
  };

  // Update the sound selector handler
  const handleSoundSelect = (value: string | number) => {
    if (value === 'add') {
      setIsAddingSoundOpen(true);
    } else {
      const newIndex = value as number;
      setSelectedSoundIndex(newIndex);
      // Update the layer with the new selected index
      onLayerUpdate({
        ...layer,
        selectedSoundIndex: newIndex
      });
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box {...dragHandleProps} sx={{ 
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          '&:active': {
            cursor: 'grabbing'
          }
        }}>
          <DragIndicator sx={{ color: 'text.secondary', opacity: 0.5 }} />
        </Box>
        <Typography variant="subtitle1" sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
          <StatusLight isPlaying={playingLayers.includes(layer.id)} />
          {layer.name}
          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
            ({layer.loopLengthMs} ms)
          </Typography>
        </Typography>
        <ToggleButtonGroup
          value={getEffectiveValue('mode')}
          exclusive
          onChange={(_, value) => value && handleModeChange(value)}
          size="small"
          sx={{ mr: 1 }}
        >
          <ToggleButton value={LayerMode.Shuffle} aria-label="shuffle mode">
            <Shuffle fontSize="small" />
          </ToggleButton>
          <ToggleButton value={LayerMode.Sequence} aria-label="sequence mode">
            <Repeat fontSize="small" />
          </ToggleButton>
          <ToggleButton value={LayerMode.Single} aria-label="single mode">
            <RadioButtonChecked fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        <IconButton onClick={() => setIsConfigureOpen(true)} size="small">
          <Settings />
        </IconButton>
        <IconButton onClick={() => setIsConfirmRemoveOpen(true)} size="small">
          <Delete />
        </IconButton>
      </Box>

      {/* Controls row */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr 1fr', 
        gap: 2, 
        alignItems: 'center',
        px: 2,
        py: 1,
      }}>
        {/* Sound controls group */}
        <Box sx={{
          gridColumn: 'span 3',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          p: 1.5,
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr',
          gap: 2,
          alignItems: 'center'
        }}>
          {/* Sound selector */}
          <Select
            value={sounds.length === 0 ? 'add' : selectedSoundIndex}
            onChange={(e) => handleSoundSelect(e.target.value)}
            size="small"
            fullWidth
          >
            {sounds.map((sound, index) => {
              const soundFile = soundFiles.find(sf => sf.id === sound.fileId);
              return (
                <MenuItem key={index} value={index}>
                  {soundFile?.name || 'Unknown Sound'}
                </MenuItem>
              );
            })}
            <Divider />
            <MenuItem value="add" sx={{ color: 'primary.main' }}>
              <Add fontSize="small" sx={{ mr: 1 }} />
              {sounds.length === 0 ? 'Add First Sound' : 'Add Sound'}
            </MenuItem>
          </Select>

          {/* Sound volume slider */}
          <Box>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
              Volume
            </Typography>
            <Tooltip title={sounds.length <= 1 ? "At least two sounds are required to adjust individual sound volumes" : ""}>
              <Box>  {/* Wrapper needed because Tooltip can't be applied directly to disabled elements */}
                <DualValueSlider
                  value={tempValues[`volume-${selectedSound.id}`] ?? getNumericValue('volume', selectedSound.id)}
                  onChange={(_, value) => handleSliderChange(`volume-${selectedSound.id}`, value as number)}
                  onChangeCommitted={(_, value) => handleSoundVolumeChange(selectedSound, value as number)}
                  min={0}
                  max={1}
                  step={0.01}
                  size="small"
                  aria-label="Selected Sound Volume"
                  className={hasPresetOverride('volume', selectedSound.id) ? 'preset-active' : ''}
                  marks={[{ 
                    value: getMarkValue('volume', selectedSound.id),
                    label: ''
                  }]}
                  disabled={sounds.length === 0 || sounds.length === 1}
                  sx={getDefaultValueStyle(
                    getDefaultValue('volume', selectedSound.id),
                    0,
                    1
                  )}
                />
              </Box>
            </Tooltip>
          </Box>

          {/* Sound frequency slider */}
          <Box>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
              Frequency
            </Typography>
            <Tooltip title={
              sounds.length <= 1 
                ? "At least two sounds are required to adjust frequencies" 
                : (getEffectiveValue('mode') as LayerMode) !== LayerMode.Shuffle
                  ? "Frequency adjustment is only available in Shuffle mode"
                  : ""
            }>
              <Box>  {/* Wrapper needed because Tooltip can't be applied directly to disabled elements */}
                <DualValueSlider
                  value={tempValues[`frequency-${selectedSound.id}`] ?? getNumericValue('frequency', selectedSound.id)}
                  onChange={(_, value) => handleSliderChange(`frequency-${selectedSound.id}`, value as number)}
                  onChangeCommitted={(_, value) => handleSoundFrequencyChange(selectedSound, value as number)}
                  min={0}
                  max={1}
                  step={0.01}
                  size="small"
                  aria-label="Sound Frequency"
                  className={hasPresetOverride('frequency', selectedSound.id) ? 'preset-active' : ''}
                  marks={[{ 
                    value: getMarkValue('frequency', selectedSound.id),
                    label: ''
                  }]}
                  disabled={sounds.length === 0 || sounds.length === 1 || (getEffectiveValue('mode') as LayerMode) !== LayerMode.Shuffle}
                  sx={getDefaultValueStyle(
                    getDefaultValue('frequency', selectedSound.id),
                    0,
                    1
                  )}
                />
              </Box>
            </Tooltip>
          </Box>
        </Box>

        {/* Layer controls */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Volume
          </Typography>
          <DualValueSlider
            value={tempValues['volume'] ?? getNumericValue('volume')}
            onChange={(_, value) => handleSliderChange('volume', value as number)}
            onChangeCommitted={(_, value) => handleLayerVolumeChange(value as number)}
            valueLabelDisplay="auto"
            min={0}
            max={1}
            step={0.01}
            size="small"
            aria-label="Layer Volume"
            className={hasPresetOverride('volume') ? 'preset-active' : ''}
            marks={[{ 
              value: getMarkValue('volume'),
              label: ''
            }]}
            sx={getDefaultValueStyle(
              getDefaultValue('volume'),
              0,
              1
            )}
          />
        </Box>

        {/* Weight slider */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Weight
          </Typography>
          <DualValueSlider
            value={tempValues['weight'] ?? getNumericValue('weight')}
            onChange={(_, value) => handleSliderChange('weight', value as number)}
            onChangeCommitted={(_, value) => handleLayerWeightChange(value as number)}
            valueLabelDisplay="auto"
            min={0}
            max={2}
            step={0.1}
            size="small"
            aria-label="Layer Weight"
            className={hasPresetOverride('weight') ? 'preset-active' : ''}
            marks={[{ 
              value: getMarkValue('weight'),
              label: ''
            }]}
            sx={getDefaultValueStyle(
              getDefaultValue('weight'),
              0,
              2
            )}
          />
        </Box>

        {/* Chance slider */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Chance
          </Typography>
          <DualValueSlider
            value={tempValues['chance'] ?? getNumericValue('chance')}
            onChange={(_, value) => handleSliderChange('chance', value as number)}
            onChangeCommitted={(_, value) => handleLayerChanceChange(value as number)}
            valueLabelDisplay="auto"
            min={0}
            max={1}
            step={0.01}
            size="small"
            aria-label="Layer Chance"
            className={hasPresetOverride('chance') ? 'preset-active' : ''}
            marks={[{ 
              value: getMarkValue('chance'),
              label: ''
            }]}
            sx={getDefaultValueStyle(
              getDefaultValue('chance'),
              0,
              1
            )}
          />
        </Box>

        {/* Cooldown Cycles slider */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Cooldown
          </Typography>
          <DualValueSlider
            value={tempValues['cooldownCycles'] ?? getNumericValue('cooldownCycles')}
            onChange={(_, value) => handleSliderChange('cooldownCycles', value as number)}
            onChangeCommitted={(_, value) => handleLayerCooldownChange(value as number)}
            valueLabelDisplay="auto"
            min={0}
            max={15}
            step={1}
            size="small"
            aria-label="Layer Cooldown Cycles"
            className={hasPresetOverride('cooldownCycles') ? 'preset-active' : ''}
            marks={[{ 
              value: getMarkValue('cooldownCycles'),
              label: ''
            }]}
            sx={getDefaultValueStyle(
              getDefaultValue('cooldownCycles'),
              0,
              15
            )}
          />
        </Box>
      </Box>

      {/* Configure Layer Dialog */}
      <Dialog
        open={isConfigureOpen}
        onClose={() => setIsConfigureOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Configure Layer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layer Name"
            fullWidth
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            type="number"
            margin="dense"
            label="Loop Length (ms)"
            fullWidth
            value={newLoopLength}
            onChange={(e) => setNewLoopLength(Number(e.target.value))}
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfigureOpen(false)}>Cancel</Button>
          <Button onClick={handleConfigure} variant="contained" disabled={!newLayerName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <Dialog
        open={isConfirmRemoveOpen}
        onClose={() => setIsConfirmRemoveOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Remove Layer</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove "{layer.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfirmRemoveOpen(false)}>Cancel</Button>
          <Button 
            onClick={() => {
              onLayerRemove(layer.id);
              setIsConfirmRemoveOpen(false);
            }} 
            color="error"
            variant="contained"
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      <AddLayerDialog
        open={isAddingSoundOpen}
        onClose={() => setIsAddingSoundOpen(false)}
        onAdd={handleAddSound}
        soundFiles={soundFiles}
        onSoundFilesChange={onSoundFilesChange}
        mode="sound"
      />
    </Paper>
  );
}; 