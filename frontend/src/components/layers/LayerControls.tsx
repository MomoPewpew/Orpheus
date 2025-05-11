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
} from '@mui/material';
import { Edit, Delete, Add, DragIndicator } from '@mui/icons-material';
import { Layer, LayerSound, SoundFile, getLayerSoundName } from '../../types/audio';
import AddLayerDialog from '../AddLayerDialog';
import { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

interface LayerControlsProps {
  layer: Layer;
  soundFiles: SoundFile[];
  onLayerUpdate: (layer: Layer) => void;
  onLayerEdit: (layer: Layer) => void;
  onLayerRemove: (layerId: string) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
}

export const LayerControls: React.FC<LayerControlsProps> = ({
  layer,
  soundFiles = [],
  onLayerUpdate,
  onLayerEdit,
  onLayerRemove,
  dragHandleProps,
}) => {
  const sounds = layer.sounds || [];
  const [selectedSoundIndex, setSelectedSoundIndex] = useState(0);
  const [isAddingSoundOpen, setIsAddingSoundOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [newLayerName, setNewLayerName] = useState(layer.name);

  // Debug logging
  console.debug('LayerControls render:', {
    layer,
    soundFiles,
    sounds,
    selectedSoundIndex
  });

  const updateLayer = (updates: Partial<Layer>) => {
    onLayerUpdate({ ...layer, ...updates });
  };

  const updateSound = (soundIndex: number, updates: Partial<LayerSound>) => {
    const newSounds = [...sounds];
    if (updates.frequency !== undefined) {
      // When updating frequency, ensure we're not also setting weight
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

  const handleRename = () => {
    if (newLayerName.trim()) {
      onLayerUpdate({ ...layer, name: newLayerName.trim() });
      setIsRenameOpen(false);
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <div {...dragHandleProps}>
          <DragIndicator 
            sx={{ 
              color: 'text.secondary',
              opacity: 0.5,
              cursor: 'grab',
              fontSize: 20,
            }} 
          />
        </div>
        <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
          {layer.name}
        </Typography>
        <IconButton size="small" onClick={() => setIsRenameOpen(true)}>
          <Edit fontSize="small" />
        </IconButton>
        <IconButton size="small" onClick={() => setIsConfirmRemoveOpen(true)}>
          <Delete fontSize="small" />
        </IconButton>
      </Box>

      {/* Controls row */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr', 
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
            <Slider
              value={selectedSound.volume}
              onChange={(_, value) => updateSound(selectedSoundIndex, { volume: value as number })}
              min={0}
              max={1}
              step={0.01}
              size="small"
              aria-label="Selected Sound Volume"
              id={`sound-volume-${selectedSoundIndex}`}
              disabled={sounds.length === 0}
            />
          </Box>

          {/* Sound frequency slider */}
          <Box>
            <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
              Frequency
            </Typography>
            <Slider
              value={selectedSound.frequency}
              onChange={(_, value) => updateSound(selectedSoundIndex, { frequency: value as number })}
              min={0}
              max={1}
              step={0.01}
              size="small"
              aria-label="Sound Frequency"
              id={`sound-frequency-${selectedSoundIndex}`}
              disabled={sounds.length === 0}
            />
          </Box>
        </Box>

        {/* Layer-level controls */}
        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Chance
          </Typography>
          <Slider
            value={layer.chance || 1}
            onChange={(_, value) => updateLayer({ chance: value as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            aria-label="Layer Chance"
            id={`layer-chance-${layer.id}`}
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Volume
          </Typography>
          <Slider
            value={layer.volume || 1}
            onChange={(_, value) => updateLayer({ volume: value as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            aria-label="Layer Volume"
            id={`layer-volume-${layer.id}`}
          />
        </Box>

        <Box>
          <Typography variant="caption" sx={{ mb: 0.5, display: 'block', textAlign: 'center' }}>
            Weight
          </Typography>
          <Slider
            value={layer.weight || 1}
            onChange={(_, value) => updateLayer({ weight: value as number })}
            min={0}
            max={1}
            step={0.01}
            size="small"
            aria-label="Layer Weight"
            id={`layer-weight-${layer.id}`}
          />
        </Box>
      </Box>

      {/* Rename Dialog */}
      <Dialog 
        open={isRenameOpen} 
        onClose={() => setIsRenameOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rename Layer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layer Name"
            fullWidth
            value={newLayerName}
            onChange={(e) => setNewLayerName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleRename();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRenameOpen(false)}>Cancel</Button>
          <Button onClick={handleRename} variant="contained" disabled={!newLayerName.trim()}>
            Rename
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