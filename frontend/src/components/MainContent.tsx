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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import { Add as AddIcon, Delete, Settings, PlayArrow, Stop } from '@mui/icons-material';
import { Environment, Layer, Preset, SoundFile, setLayerVolume, getLayerVolume, LayerSound, PlayState } from '../types/audio';
import { generateId } from '../utils/ids';
import { LayerControls } from './layers/LayerControls';
import AddLayerDialog from './AddLayerDialog';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DroppableProvided, DroppableStateSnapshot, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd';
import EnvironmentConfigOverlay from './overlays/EnvironmentConfigOverlay';
import { SoundboardOverlay } from './overlays/SoundboardOverlay';
import PresetControls from './PresetControls';

interface MainContentProps {
  environment: Environment;
  showSoundboard: boolean;
  soundFiles: SoundFile[];
  globalSoundboard: string[];
  onEnvironmentUpdate: (environment: Environment) => void;
  onEnvironmentRemove: (environmentId: string) => void;
  onLayerAdd: (layer: Layer) => void;
  onLayerUpdate: (layer: Layer) => void;
  onPresetCreate: (preset: Preset) => void;
  onPresetSelect: (presetId: string | undefined) => void;
  onPresetUpdate: (preset: Preset) => void;
  onPresetDelete: (presetId: string) => void;
  onPresetsReorder: (presets: Preset[]) => void;
  onSoundFilesChange: (files: SoundFile[]) => void;
  onGlobalSoundboardChange: (soundIds: string[]) => void;
  onToggleSoundboard: () => void;
  onPlayStop: () => void;
}

const DRAWER_WIDTH = 300;

export const MainContent: React.FC<MainContentProps> = ({
  environment,
  showSoundboard,
  soundFiles,
  globalSoundboard,
  onEnvironmentUpdate,
  onEnvironmentRemove,
  onLayerAdd,
  onLayerUpdate,
  onPresetCreate,
  onPresetSelect,
  onPresetUpdate,
  onPresetDelete,
  onPresetsReorder,
  onSoundFilesChange,
  onGlobalSoundboardChange,
  onToggleSoundboard,
  onPlayStop,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [showEnvironmentConfig, setShowEnvironmentConfig] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [editingLayer, setEditingLayer] = useState<Layer | null>(null);

  if (!environment) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 3,
        }}
      >
        <Typography>Select an environment to begin</Typography>
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
    
    if (activePreset) {
      // If the new value matches the environment's base value, remove the override
      if (newMaxWeight === environment.maxWeight) {
        const { maxWeight, ...presetWithoutMaxWeight } = activePreset;
        onPresetUpdate(presetWithoutMaxWeight);
      } else {
        // Otherwise update the preset with the new maxWeight
        const updatedPreset = {
          ...activePreset,
          maxWeight: newMaxWeight
        };
        onPresetUpdate(updatedPreset);
      }
    } else {
      // Update the environment's maxWeight directly
      onEnvironmentUpdate({
        ...environment,
        maxWeight: newMaxWeight
      });
    }
  };

  // Get the effective maxWeight (preset override or environment default)
  const getEffectiveMaxWeight = () => {
    if (activePreset?.maxWeight !== undefined && activePreset.maxWeight !== null) {
      return activePreset.maxWeight;
    }
    return environment.maxWeight ?? 1.0; // Default to 1.0 if maxWeight is null or undefined
  };

  // Check if maxWeight has a preset override
  const hasMaxWeightOverride = () => {
    return activePreset?.maxWeight !== undefined;
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

  // Get the active preset if one is selected
  const activePreset = environment.activePresetId 
    ? environment.presets.find(p => p.id === environment.activePresetId)
    : undefined;

  // Get the default layer values (without preset overrides)
  const getDefaultLayer = (layer: Layer): Layer => {
    if (!environment.activePresetId) return layer;
    const preset = environment.presets.find(p => p.id === environment.activePresetId);
    if (!preset) return layer;
    if (!preset.layers) preset.layers = [];
    const presetLayer = preset.layers.find(p => p.id === layer.id);
    if (!presetLayer) return layer;
    return {
      ...layer,
      volume: presetLayer.volume ?? layer.volume,
      weight: presetLayer.weight ?? layer.weight,
      sounds: layer.sounds.map(sound => {
        const presetSound = presetLayer.sounds?.find(s => s.id === sound.id);
        if (!presetSound) return sound;
        return {
          ...sound,
          volume: presetSound.volume ?? sound.volume,
          frequency: presetSound.frequency ?? sound.frequency,
        };
      }),
    };
  };

  const handleAddPreset = () => {
    const basePreset = environment.presets[selectedPresetIndex];
    onPresetCreate({
      ...basePreset,
      id: generateId(),
      name: 'New Preset'
    });
  };

  const handleAddLayer = (layer: Layer) => {
    if (!environment) return;
    
    const updatedEnvironment = {
      ...environment,
      layers: [...environment.layers, layer]
    };
    onEnvironmentUpdate(updatedEnvironment);
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const { source, destination } = result;
    const layers = Array.from(environment.layers);
    const [removed] = layers.splice(source.index, 1);
    layers.splice(destination.index, 0, removed);
    onEnvironmentUpdate({
      ...environment,
      layers
    });
  };

  const handleLayerEdit = (layer: Layer) => {
    // The LayerControls component handles its own dialog state
    // We just need to pass the layer update handler
    onLayerUpdate(layer);
  };

  const handleLayerRemove = (layerId: string) => {
    // The LayerControls component handles its own confirmation dialog
    // We just need to pass the layer removal handler
    const updatedEnvironment = {
      ...environment,
      // Remove the layer from the layers array
      layers: environment.layers.filter(l => l.id !== layerId),
      // Clean up presets by removing any references to this layer
      presets: environment.presets.map(preset => ({
        ...preset,
        // Remove the layer from each preset's layers array
        layers: preset.layers.filter(l => l.id !== layerId)
      }))
    };
    onEnvironmentUpdate(updatedEnvironment);
  };

  const handleLayerUpdate = (updatedLayer: Layer) => {
    const updatedEnvironment = {
      ...environment,
      layers: environment.layers.map(l => l.id === updatedLayer.id ? updatedLayer : l)
    };
    onEnvironmentUpdate(updatedEnvironment);
    setEditingLayer(null);
  };

  return (
    <Box sx={{ 
      p: 3, 
      height: '100%', 
      position: 'relative', 
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
      gap: 3,
      overflow: 'hidden'
    }}>
      {/* Background Image */}
      {environment.backgroundImage && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 280,
            right: 0,
            bottom: 0,
            zIndex: 0,
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(2px)',
            }
          }}
        >
          <Box
            component="img"
            src={environment.backgroundImage}
            alt=""
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          />
        </Box>
      )}

      {/* Content */}
      <Box sx={{ 
        position: 'relative', 
        zIndex: 1, 
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gap: 3,
        overflow: 'hidden'
      }}>
        {/* Fixed Header Section */}
        <Box sx={{ display: 'grid', gap: 3 }}>
          {/* Environment Banner */}
          <Paper 
            elevation={0}
            sx={{ 
              bgcolor: 'transparent',
              borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
              pb: 2
            }}
          >
            <Box sx={{ 
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 2
            }}>
              <Typography variant="h4" sx={{ fontWeight: 500 }}>{environment.name}</Typography>
            </Box>
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              px: 2
            }}>
              {/* Left side - Maximum Weight */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Maximum Weight:
                </Typography>
                <TextField
                  type="number"
                  value={getEffectiveMaxWeight()}
                  onChange={handleMaxWeightChange}
                  size="small"
                  sx={{
                    width: 100,
                    // Apply purple color when there's a preset override
                    '& .MuiInputBase-root': {
                      color: hasMaxWeightOverride() ? 'secondary.main' : 'inherit',
                      borderColor: hasMaxWeightOverride() ? 'secondary.main' : 'inherit',
                      '&:hover': {
                        borderColor: hasMaxWeightOverride() ? 'secondary.main' : 'inherit'
                      },
                      '&.Mui-focused': {
                        borderColor: hasMaxWeightOverride() ? 'secondary.main' : 'inherit'
                      }
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: hasMaxWeightOverride() ? 'secondary.main' : 'inherit'
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: hasMaxWeightOverride() ? 'secondary.main' : 'inherit'
                    },
                    '& .Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: hasMaxWeightOverride() ? 'secondary.main' : 'inherit'
                    }
                  }}
                  inputProps={{
                    min: 0,
                    step: 0.1
                  }}
                />
              </Box>
              
              {/* Center - Play Button */}
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <IconButton 
                  color="primary"
                  onClick={onPlayStop}
                  sx={{ 
                    width: 48,
                    height: 48,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  }}
                >
                  {environment.playState === PlayState.Playing ? (
                    <Stop />
                  ) : (
                    <PlayArrow />
                  )}
                </IconButton>
              </Box>

              {/* Right side - Settings and Delete */}
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <IconButton onClick={() => setShowEnvironmentConfig(true)}>
                  <Settings />
                </IconButton>
                <IconButton 
                  onClick={() => setIsConfirmRemoveOpen(true)} 
                  sx={{ 
                    color: 'text.secondary',
                    '&:hover': {
                      color: 'error.main'
                    }
                  }}
                >
                  <Delete />
                </IconButton>
              </Box>
            </Box>
          </Paper>

          {/* Preset Controls */}
          <Paper sx={{ p: 2 }}>
            <PresetControls
              environment={environment}
              presets={environment.presets}
              activePresetId={environment.activePresetId}
              onPresetAdd={onPresetCreate}
              onPresetUpdate={(preset) => {
                const updatedPresets = environment.presets.map(p => 
                  p.id === preset.id ? preset : p
                );
                onEnvironmentUpdate({
                  ...environment,
                  presets: updatedPresets
                });
              }}
              onPresetDelete={(presetId) => {
                const updatedPresets = environment.presets.filter(p => p.id !== presetId);
                onEnvironmentUpdate({
                  ...environment,
                  presets: updatedPresets,
                  activePresetId: environment.activePresetId === presetId 
                    ? undefined 
                    : environment.activePresetId
                });
              }}
              onPresetSelect={(presetId) => {
                onEnvironmentUpdate({
                  ...environment,
                  activePresetId: presetId
                });
                onPresetSelect(presetId);
              }}
              onPresetsReorder={(presets) => {
                onEnvironmentUpdate({
                  ...environment,
                  presets
                });
              }}
            />
          </Paper>

          <Divider />
        </Box>

        {/* Layer List with Droppable as scroll container */}
        <Box sx={{ 
          display: 'grid',
          gridTemplateRows: '1fr',
          overflow: 'hidden',
          minHeight: 0 // This is crucial for grid items to respect overflow
        }}>
          <Droppable droppableId="layers" type="layer">
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <Box
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  p: 2,
                  bgcolor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                  borderRadius: 1,
                  overflow: 'auto',
                  height: '100%', // Make it fill the available space
                  minHeight: 0 // This is crucial for flex items to respect overflow
                }}
              >
                {environment.layers.map((layer, index) => (
                  <Draggable key={layer.id} draggableId={layer.id} index={index}>
                    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={{
                          ...provided.draggableProps.style,
                          opacity: snapshot.isDragging ? 0.5 : 1,
                        }}
                      >
                        <LayerControls
                          layer={layer}
                          soundFiles={soundFiles}
                          onLayerUpdate={onLayerUpdate}
                          onLayerEdit={handleLayerEdit}
                          onLayerRemove={handleLayerRemove}
                          dragHandleProps={provided.dragHandleProps}
                          activePreset={activePreset}
                          defaultLayer={getDefaultLayer(layer)}
                          onPresetUpdate={onPresetUpdate}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
                
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddLayer(true)}
                  sx={{
                    mt: 2,
                    alignSelf: 'flex-start',
                    color: '#1976d2',
                    '&:hover': {
                      bgcolor: 'rgba(25, 118, 210, 0.04)',
                    },
                  }}
                >
                  ADD LAYER
                </Button>
              </Box>
            )}
          </Droppable>
        </Box>

        {/* Replace Soundboard Drawer with Overlay */}
        {showSoundboard && (
          <SoundboardOverlay
            environment={environment}
            onClose={onToggleSoundboard}
            soundFiles={soundFiles}
            globalSoundboard={globalSoundboard}
            onSoundFilesChange={onSoundFilesChange}
            onEnvironmentUpdate={onEnvironmentUpdate}
            onGlobalSoundboardChange={onGlobalSoundboardChange}
          />
        )}

        {showAddLayer && (
          <AddLayerDialog
            open={showAddLayer}
            onClose={() => setShowAddLayer(false)}
            onAdd={onLayerAdd}
            soundFiles={soundFiles}
            onSoundFilesChange={onSoundFilesChange}
          />
        )}

        {showEnvironmentConfig && (
          <EnvironmentConfigOverlay
            environment={environment}
            onEnvironmentUpdate={onEnvironmentUpdate}
            onClose={() => setShowEnvironmentConfig(false)}
          />
        )}

        {/* Environment Remove Confirmation Dialog */}
        <Dialog
          open={isConfirmRemoveOpen}
          onClose={() => setIsConfirmRemoveOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Remove Environment</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to remove "{environment?.name}"? This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsConfirmRemoveOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => {
                if (environment && onEnvironmentRemove) {
                  onEnvironmentRemove(environment.id);
                  setIsConfirmRemoveOpen(false);
                }
              }} 
              color="error"
              variant="contained"
            >
              Remove
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};

export default MainContent; 