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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Edit, Delete, Settings } from '@mui/icons-material';
import { Environment, Layer, EnvironmentPreset, SoundFile, setLayerVolume, getLayerVolume } from '../types/audio';
import { generateId } from '../utils/ids';
import { LayerControls } from './layers/LayerControls';
import AddLayerDialog from './AddLayerDialog';
import { 
  Droppable, 
  Draggable, 
  DroppableProvided, 
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot 
} from '@hello-pangea/dnd';
import EnvironmentConfigOverlay from './overlays/EnvironmentConfigOverlay';

interface MainContentProps {
  environment: Environment | null;
  showSoundboard: boolean;
  soundFiles: SoundFile[];
  onEnvironmentUpdate: (environment: Environment) => void;
  onEnvironmentRemove: (environmentId: string) => void;
  onLayerAdd: (layer: Layer) => void;
  onLayerUpdate: (layer: Layer) => void;
  onPresetCreate: (preset: EnvironmentPreset) => void;
  onPresetSelect: (presetId: string | undefined) => void;
  onSoundFilesChange: (files: SoundFile[]) => void;
}

const DRAWER_WIDTH = 300;

export const MainContent: React.FC<MainContentProps> = ({
  environment,
  showSoundboard,
  soundFiles,
  onEnvironmentUpdate,
  onEnvironmentRemove,
  onLayerAdd,
  onLayerUpdate,
  onPresetCreate,
  onPresetSelect,
  onSoundFilesChange,
}) => {
  const [selectedPresetIndex, setSelectedPresetIndex] = useState(0);
  const [showAddLayer, setShowAddLayer] = useState(false);
  const [showEnvironmentConfig, setShowEnvironmentConfig] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);

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

  return (
    <Box sx={{ p: 3, height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
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
      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Fixed Header Section */}
        <Box sx={{ flexShrink: 0 }}>
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
              justifyContent: 'space-between',
              px: 2,
              pb: 2
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  Maximum Weight:
                </Typography>
                <TextField
                  type="number"
                  value={environment?.maxWeight}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value);
                    if (!isNaN(value) && value >= 0 && environment) {
                      onEnvironmentUpdate({
                        ...environment,
                        maxWeight: value
                      });
                    }
                  }}
                  size="small"
                  sx={{ width: 100 }}
                  inputProps={{ min: 0, step: 0.1 }}
                />
              </Box>
              <Box>
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

          {/* Presets Section */}
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
        </Box>

        {/* Scrollable Layer List */}
        <Box sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          position: 'relative',
          minHeight: 100
        }}>
          <Droppable droppableId="layers" type="layer">
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <Stack
                spacing={1}
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{ 
                  minHeight: 50,
                  backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                  transition: 'background-color 0.2s ease',
                  p: 1
                }}
              >
                {environment.layers.map((layer, index) => (
                  <Draggable 
                    key={layer.id} 
                    draggableId={layer.id} 
                    index={index}
                  >
                    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                      <Box
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          opacity: snapshot.isDragging ? 0.8 : 1,
                          transition: 'opacity 0.2s ease',
                          backgroundColor: snapshot.isDragging ? 'action.hover' : 'transparent'
                        }}
                      >
                        <LayerControls
                          layer={layer}
                          soundFiles={soundFiles}
                          onLayerUpdate={onLayerUpdate}
                          onLayerEdit={(layer: Layer) => {
                            // TODO: Implement layer editing
                            console.log('Edit layer:', layer);
                          }}
                          onLayerRemove={(layerId: string) => {
                            const updatedLayers = environment.layers.filter(l => l.id !== layerId);
                            onEnvironmentUpdate({
                              ...environment,
                              layers: updatedLayers
                            });
                          }}
                          dragHandleProps={provided.dragHandleProps}
                        />
                      </Box>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </Stack>
            )}
          </Droppable>

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