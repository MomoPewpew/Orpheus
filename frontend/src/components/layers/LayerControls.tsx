import React, { useState } from 'react';
import {
  Box,
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
  Button,
  TextField,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import { Theme } from '@mui/material/styles';
import { Edit, Delete, Add, DragIndicator, Settings, Shuffle, Repeat, RadioButtonChecked } from '@mui/icons-material';
import { Layer, LayerSound, SoundFile, getLayerSoundName, Preset, PresetLayer, PresetSound, LayerMode } from '../../types/audio';
import AddLayerDialog from '../AddLayerDialog';
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { alpha } from '@mui/material/styles';

export {};

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
  isPlaying?: boolean; // New prop to indicate if the layer is currently playing
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layer,
  soundFiles = [],
  onLayerUpdate,
  onLayerEdit,
  onLayerRemove,
  dragHandleProps,
  activePreset,
  defaultLayer,
  onPresetUpdate,
  isPlaying = false, // Default to false if not provided
}) => {
  const sounds = layer.sounds || [];
  const defaultSounds = defaultLayer?.sounds || sounds;
  const [selectedSoundIndex, setSelectedSoundIndex] = useState(0);
  const [isAddingSoundOpen, setIsAddingSoundOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [isConfigureOpen, setIsConfigureOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState(layer.name);
  const [newLoopLength, setNewLoopLength] = useState(layer.loopLengthMs);

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

  // Get the default mode value for a layer
  const getDefaultMode = (): LayerMode => {
    return layer.mode ?? LayerMode.Shuffle;
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

  const updateLayer = (updates: Partial<Layer>) => {
    onLayerUpdate({ ...layer, ...updates });
  };

  const updateSound = (soundIndex: number, updates: Partial<LayerSound>) => {
    const newSounds = [...sounds];
    if (updates.frequency !== undefined) {
      const { weight, ...cleanUpdates } = updates as any;
      newSounds[soundIndex] = { ...newSounds[soundIndex], ...cleanUpdates };
    } else {
      newSounds[soundIndex] = { ...newSounds[soundIndex], ...updates };
    }
    updateLayer({ sounds: newSounds });
  };

  const handleAddSound = (newLayer: Layer) => {
    // Extract the first sound from the new layer and add it to our layer
    if (newLayer.sounds.length > 0) {
      updateLayer({ 
        sounds: [...sounds, newLayer.sounds[0]]
      });
      setSelectedSoundIndex(sounds.length);
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

  // Type guard to ensure a layer is a PresetLayer
  const isPresetLayer = (layer: any): layer is PresetLayer => {
    return layer && typeof layer.id === 'string' && Array.isArray(layer.sounds);
  };

  const handleLayerVolumeChange = (newValue: number) => {
    if (activePreset && activePreset.layers) {
      // Get existing preset layer if it exists
      const existingPresetLayer = activePreset.layers.find(p => p.id === layer.id);
      
      // Create a new layer with required id and preserve existing sounds
      const updatedLayer: PresetLayer = {
        id: layer.id,
        sounds: existingPresetLayer?.sounds || []
      };

      // Only add properties that differ from base layer
      const baseVolume = getDefaultValue('volume');
      if (newValue !== baseVolume) {
        updatedLayer.volume = newValue;
      }
      if (existingPresetLayer?.weight !== undefined) {
        const baseWeight = getDefaultValue('weight');
        if (existingPresetLayer.weight !== baseWeight) {
          updatedLayer.weight = existingPresetLayer.weight;
        }
      }
      if (existingPresetLayer?.chance !== undefined) {
        const baseChance = getDefaultValue('chance');
        if (existingPresetLayer.chance !== baseChance) {
          updatedLayer.chance = existingPresetLayer.chance;
        }
      }
      if (existingPresetLayer?.cooldownCycles !== undefined) {
        const baseCooldown = getDefaultValue('cooldownCycles');
        if (existingPresetLayer.cooldownCycles !== baseCooldown) {
          updatedLayer.cooldownCycles = existingPresetLayer.cooldownCycles;
        }
      }

      // Create a new array of PresetLayer objects
      const existingLayers = activePreset.layers
        .filter(p => p.id !== layer.id)
        .map(p => {
          const layer: PresetLayer = {
            id: p.id,
            sounds: p.sounds || []
          };
          if (p.volume !== undefined) {
            const baseVolume = getDefaultValue('volume');
            if (p.volume !== baseVolume) {
              layer.volume = p.volume;
            }
          }
          if (p.weight !== undefined) {
            const baseWeight = getDefaultValue('weight');
            if (p.weight !== baseWeight) {
              layer.weight = p.weight;
            }
          }
          if (p.chance !== undefined) {
            const baseChance = getDefaultValue('chance');
            if (p.chance !== baseChance) {
              layer.chance = p.chance;
            }
          }
          if (p.cooldownCycles !== undefined) {
            const baseCooldown = getDefaultValue('cooldownCycles');
            if (p.cooldownCycles !== baseCooldown) {
              layer.cooldownCycles = p.cooldownCycles;
            }
          }
          return layer;
        });

      // Only include the layer if it has any overrides or sound overrides
      const hasOverrides = Object.keys(updatedLayer).length > 2 || // More than just id and sounds
                          (updatedLayer.sounds && updatedLayer.sounds.length > 0);

      const updatedLayers = hasOverrides 
        ? [...existingLayers, updatedLayer]
        : existingLayers;

      const updatedPreset = {
        ...activePreset,
        layers: updatedLayers
      };

      onPresetUpdate(updatedPreset);
    } else {
      onLayerUpdate({ ...layer, volume: newValue });
    }
  };

  const handleLayerWeightChange = (newValue: number) => {
    if (activePreset && activePreset.layers) {
      // Get existing preset layer if it exists
      const existingPresetLayer = activePreset.layers.find(p => p.id === layer.id);
      
      // Create a new layer with required id and preserve existing sounds
      const updatedLayer: PresetLayer = {
        id: layer.id,
        sounds: existingPresetLayer?.sounds || []
      };

      // Only add properties that differ from base layer
      if (existingPresetLayer?.volume !== undefined) {
        const baseVolume = getDefaultValue('volume');
        if (existingPresetLayer.volume !== baseVolume) {
          updatedLayer.volume = existingPresetLayer.volume;
        }
      }
      const baseWeight = getDefaultValue('weight');
      if (newValue !== baseWeight) {
        updatedLayer.weight = newValue;
      }
      if (existingPresetLayer?.chance !== undefined) {
        const baseChance = getDefaultValue('chance');
        if (existingPresetLayer.chance !== baseChance) {
          updatedLayer.chance = existingPresetLayer.chance;
        }
      }
      if (existingPresetLayer?.cooldownCycles !== undefined) {
        const baseCooldown = getDefaultValue('cooldownCycles');
        if (existingPresetLayer.cooldownCycles !== baseCooldown) {
          updatedLayer.cooldownCycles = existingPresetLayer.cooldownCycles;
        }
      }

      // Create a new array of PresetLayer objects
      const existingLayers = activePreset.layers
        .filter(p => p.id !== layer.id)
        .map(p => {
          const layer: PresetLayer = {
            id: p.id,
            sounds: p.sounds || []
          };
          if (p.volume !== undefined) {
            const baseVolume = getDefaultValue('volume');
            if (p.volume !== baseVolume) {
              layer.volume = p.volume;
            }
          }
          if (p.weight !== undefined) {
            const baseWeight = getDefaultValue('weight');
            if (p.weight !== baseWeight) {
              layer.weight = p.weight;
            }
          }
          if (p.chance !== undefined) {
            const baseChance = getDefaultValue('chance');
            if (p.chance !== baseChance) {
              layer.chance = p.chance;
            }
          }
          if (p.cooldownCycles !== undefined) {
            const baseCooldown = getDefaultValue('cooldownCycles');
            if (p.cooldownCycles !== baseCooldown) {
              layer.cooldownCycles = p.cooldownCycles;
            }
          }
          return layer;
        });

      // Only include the layer if it has any overrides or sound overrides
      const hasOverrides = Object.keys(updatedLayer).length > 2 || // More than just id and sounds
                          (updatedLayer.sounds && updatedLayer.sounds.length > 0);

      const updatedLayers = hasOverrides 
        ? [...existingLayers, updatedLayer]
        : existingLayers;

      const updatedPreset = {
        ...activePreset,
        layers: updatedLayers
      };

      onPresetUpdate(updatedPreset);
    } else {
      onLayerUpdate({ ...layer, weight: newValue });
    }
  };

  const handleLayerChanceChange = (newValue: number) => {
    if (activePreset && activePreset.layers) {
      // Get existing preset layer if it exists
      const existingPresetLayer = activePreset.layers.find(p => p.id === layer.id);
      
      // Create a new layer with required id and preserve existing sounds
      const updatedLayer: PresetLayer = {
        id: layer.id,
        sounds: existingPresetLayer?.sounds || []
      };

      // Only add properties that differ from base layer
      if (existingPresetLayer?.volume !== undefined) {
        const baseVolume = getDefaultValue('volume');
        if (existingPresetLayer.volume !== baseVolume) {
          updatedLayer.volume = existingPresetLayer.volume;
        }
      }
      if (existingPresetLayer?.weight !== undefined) {
        const baseWeight = getDefaultValue('weight');
        if (existingPresetLayer.weight !== baseWeight) {
          updatedLayer.weight = existingPresetLayer.weight;
        }
      }
      const baseChance = getDefaultValue('chance');
      if (newValue !== baseChance) {
        updatedLayer.chance = newValue;
      }
      if (existingPresetLayer?.cooldownCycles !== undefined) {
        const baseCooldown = getDefaultValue('cooldownCycles');
        if (existingPresetLayer.cooldownCycles !== baseCooldown) {
          updatedLayer.cooldownCycles = existingPresetLayer.cooldownCycles;
        }
      }

      // Create a new array of PresetLayer objects
      const existingLayers = activePreset.layers
        .filter(p => p.id !== layer.id)
        .map(p => {
          const layer: PresetLayer = {
            id: p.id,
            sounds: p.sounds || []
          };
          if (p.volume !== undefined) {
            const baseVolume = getDefaultValue('volume');
            if (p.volume !== baseVolume) {
              layer.volume = p.volume;
            }
          }
          if (p.weight !== undefined) {
            const baseWeight = getDefaultValue('weight');
            if (p.weight !== baseWeight) {
              layer.weight = p.weight;
            }
          }
          if (p.chance !== undefined) {
            const baseChance = getDefaultValue('chance');
            if (p.chance !== baseChance) {
              layer.chance = p.chance;
            }
          }
          if (p.cooldownCycles !== undefined) {
            const baseCooldown = getDefaultValue('cooldownCycles');
            if (p.cooldownCycles !== baseCooldown) {
              layer.cooldownCycles = p.cooldownCycles;
            }
          }
          return layer;
        });

      // Only include the layer if it has any overrides or sound overrides
      const hasOverrides = Object.keys(updatedLayer).length > 2 || // More than just id and sounds
                          (updatedLayer.sounds && updatedLayer.sounds.length > 0);

      const updatedLayers = hasOverrides 
        ? [...existingLayers, updatedLayer]
        : existingLayers;

      const updatedPreset = {
        ...activePreset,
        layers: updatedLayers
      };

      onPresetUpdate(updatedPreset);
    } else {
      onLayerUpdate({ ...layer, chance: newValue });
    }
  };

  const handleLayerCooldownChange = (newValue: number) => {
    if (activePreset && activePreset.layers) {
      // Get existing preset layer if it exists
      const existingPresetLayer = activePreset.layers.find(p => p.id === layer.id);
      
      // Create a new layer with required id and preserve existing sounds
      const updatedLayer: PresetLayer = {
        id: layer.id,
        sounds: existingPresetLayer?.sounds || []
      };

      // Only add properties that differ from base layer
      if (existingPresetLayer?.volume !== undefined) {
        const baseVolume = getDefaultValue('volume');
        if (existingPresetLayer.volume !== baseVolume) {
          updatedLayer.volume = existingPresetLayer.volume;
        }
      }
      if (existingPresetLayer?.weight !== undefined) {
        const baseWeight = getDefaultValue('weight');
        if (existingPresetLayer.weight !== baseWeight) {
          updatedLayer.weight = existingPresetLayer.weight;
        }
      }
      if (existingPresetLayer?.chance !== undefined) {
        const baseChance = getDefaultValue('chance');
        if (existingPresetLayer.chance !== baseChance) {
          updatedLayer.chance = existingPresetLayer.chance;
        }
      }
      const baseCooldown = getDefaultValue('cooldownCycles');
      if (newValue !== baseCooldown) {
        updatedLayer.cooldownCycles = newValue;
      }

      // Create a new array of PresetLayer objects
      const existingLayers = activePreset.layers
        .filter(p => p.id !== layer.id)
        .map(p => {
          const layer: PresetLayer = {
            id: p.id,
            sounds: p.sounds || []
          };
          if (p.volume !== undefined) {
            const baseVolume = getDefaultValue('volume');
            if (p.volume !== baseVolume) {
              layer.volume = p.volume;
            }
          }
          if (p.weight !== undefined) {
            const baseWeight = getDefaultValue('weight');
            if (p.weight !== baseWeight) {
              layer.weight = p.weight;
            }
          }
          if (p.chance !== undefined) {
            const baseChance = getDefaultValue('chance');
            if (p.chance !== baseChance) {
              layer.chance = p.chance;
            }
          }
          if (p.cooldownCycles !== undefined) {
            const baseCooldown = getDefaultValue('cooldownCycles');
            if (p.cooldownCycles !== baseCooldown) {
              layer.cooldownCycles = p.cooldownCycles;
            }
          }
          return layer;
        });

      // Only include the layer if it has any overrides or sound overrides
      const hasOverrides = Object.keys(updatedLayer).length > 2 || // More than just id and sounds
                          (updatedLayer.sounds && updatedLayer.sounds.length > 0);

      const updatedLayers = hasOverrides 
        ? [...existingLayers, updatedLayer]
        : existingLayers;

      const updatedPreset = {
        ...activePreset,
        layers: updatedLayers
      };

      onPresetUpdate(updatedPreset);
    } else {
      onLayerUpdate({ ...layer, cooldownCycles: newValue });
    }
  };

  const handleSoundVolumeChange = (selectedSound: LayerSound, newValue: number) => {
    if (activePreset && activePreset.layers) {
      // Create or update preset layer
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id, sounds: [] };
      const presetSounds = presetLayer.sounds || [];
      
      // Get the base values to compare against
      const baseVolume = getDefaultValue('volume', selectedSound.id);
      const baseFrequency = getDefaultValue('frequency', selectedSound.id);
      
      // Filter out the current sound
      const updatedPresetSounds = presetSounds.filter(s => s.id !== selectedSound.id);
      
      // Check if we need to keep this sound in the preset
      const existingPresetSound = presetSounds.find(s => s.id === selectedSound.id);
      const keepVolume = baseVolume !== undefined && newValue !== baseVolume;
      const keepFrequency = existingPresetSound?.frequency !== undefined && 
                           baseFrequency !== undefined && 
                           existingPresetSound.frequency !== baseFrequency;
      
      // Only add the sound if at least one property differs from base
      if (keepVolume || keepFrequency) {
        const presetSound = {
          id: selectedSound.id
        } as PresetSound;

        // Only include volume if it differs from base
        if (keepVolume) {
          presetSound.volume = newValue;
        }

        // Keep frequency if it was already overridden and still differs from base
        if (keepFrequency) {
          presetSound.frequency = existingPresetSound!.frequency;
        }

        updatedPresetSounds.push(presetSound);
      }

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
            return Object.keys(p).length > 1 || (p.sounds && p.sounds.length > 0);
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
    if (activePreset && activePreset.layers) {
      // Create or update preset layer
      const presetLayer = activePreset.layers.find(p => p.id === layer.id) || { id: layer.id, sounds: [] };
      const presetSounds = presetLayer.sounds || [];
      
      // Get the base values to compare against
      const baseVolume = getDefaultValue('volume', selectedSound.id);
      const baseFrequency = getDefaultValue('frequency', selectedSound.id);
      
      // Filter out the current sound
      const updatedPresetSounds = presetSounds.filter(s => s.id !== selectedSound.id);
      
      // Check if we need to keep this sound in the preset
      const existingPresetSound = presetSounds.find(s => s.id === selectedSound.id);
      const keepVolume = existingPresetSound?.volume !== undefined && 
                        baseVolume !== undefined && 
                        existingPresetSound.volume !== baseVolume;
      const keepFrequency = baseFrequency !== undefined && newValue !== baseFrequency;
      
      // Only add the sound if at least one property differs from base
      if (keepVolume || keepFrequency) {
        const presetSound = {
          id: selectedSound.id
        } as PresetSound;

        // Keep volume if it was already overridden and still differs from base
        if (keepVolume) {
          presetSound.volume = existingPresetSound!.volume;
        }

        // Only include frequency if it differs from base
        if (keepFrequency) {
          presetSound.frequency = newValue;
        }

        updatedPresetSounds.push(presetSound);
      }

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
            return Object.keys(p).length > 1 || (p.sounds && p.sounds.length > 0);
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
          <StatusLight isPlaying={isPlaying} />
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
            onChange={(e) => {
              const value = e.target.value;
              if (value === 'add') {
                setIsAddingSoundOpen(true);
              } else {
                setSelectedSoundIndex(value as number);
              }
            }}
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
                  value={getNumericValue('volume', selectedSound.id)}
                  onChange={(_, value) => handleSoundVolumeChange(selectedSound, value as number)}
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
                : (getEffectiveValue('mode') as LayerMode) === LayerMode.Single 
                  ? "Frequency adjustment is not available in Single mode"
                  : ""
            }>
              <Box>  {/* Wrapper needed because Tooltip can't be applied directly to disabled elements */}
                <DualValueSlider
                  value={getNumericValue('frequency', selectedSound.id)}
                  onChange={(_, value) => handleSoundFrequencyChange(selectedSound, value as number)}
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
                  disabled={sounds.length === 0 || sounds.length === 1 || (getEffectiveValue('mode') as LayerMode) === LayerMode.Single}
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
            value={getNumericValue('volume')}
            onChange={(_, value) => handleLayerVolumeChange(value as number)}
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
            value={getNumericValue('weight')}
            onChange={(_, value) => handleLayerWeightChange(value as number)}
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
            value={getNumericValue('chance')}
            onChange={(_, value) => handleLayerChanceChange(value as number)}
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
            value={getNumericValue('cooldownCycles')}
            onChange={(_, value) => handleLayerCooldownChange(value as number)}
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
        mode="sound"
      />
    </Paper>
  );
}; 