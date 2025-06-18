import React, { useState } from 'react';
import { Environment, Preset } from '../types/audio';
import { generateId } from '../utils/ids';
import {
  Box,
  Button,
  IconButton,
  Stack,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

interface PresetManagerProps {
  presets: Preset[];
  activePresetId: string | null;
  environment: Environment;
  onPresetCreate: (preset: Preset) => void;
  onPresetUpdate: (preset: Preset) => void;
  onPresetDelete: (presetId: string) => void;
  onPresetSelect: (presetId: string | null) => void;
}

const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  activePresetId,
  onPresetCreate,
  onPresetUpdate,
  onPresetDelete,
  onPresetSelect,
}) => {
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  const handleAddPreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: Preset = {
      id: generateId(),
      name: newPresetName.trim(),
      layers: []
    };

    onPresetCreate(newPreset);
    setNewPresetName('');
    setShowAddDialog(false);
  };

  const handleUpdatePreset = () => {
    if (!editingPreset || !editingPreset.name.trim()) return;

    onPresetUpdate(editingPreset);
    setEditingPreset(null);
  };

  return (
    <Box>
      {/* Header row */}
      <Stack 
        direction="row" 
        alignItems="center" 
        justifyContent="space-between" 
        sx={{ mb: 2 }}
      >
        <Typography variant="h6">Presets</Typography>
        <Button
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          size="small"
        >
          Add Preset
        </Button>
      </Stack>

      {/* Horizontal preset list */}
      <Stack 
        direction="row" 
        spacing={1} 
        sx={{ 
          overflowX: 'auto',
          pb: 1, // Add padding to account for potential scrollbar
          flexWrap: 'nowrap', // Prevent wrapping
          minHeight: 32 // Ensure consistent height
        }}
      >
        {/* Default preset chip */}
        <Chip
          label="Default"
          onClick={() => onPresetSelect(null)}
          color={activePresetId === null ? "primary" : "default"}
          variant={activePresetId === null ? "filled" : "outlined"}
          sx={{ 
            minWidth: 80,
            '&:hover': {
              backgroundColor: activePresetId === null ? undefined : 'action.hover'
            }
          }}
        />

        {/* Preset chips */}
        {presets.map((preset) => (
          editingPreset?.id === preset.id ? (
            <TextField
              key={preset.id}
              value={editingPreset.name}
              onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleUpdatePreset();
                }
              }}
              onBlur={handleUpdatePreset}
              autoFocus
              size="small"
              sx={{ width: 100 }}
            />
          ) : (
            <Chip
              key={preset.id}
              label={preset.name}
              onClick={() => onPresetSelect(preset.id)}
              color={activePresetId === preset.id ? "primary" : "default"}
              variant={activePresetId === preset.id ? "filled" : "outlined"}
              sx={{ 
                minWidth: 80,
                '&:hover': {
                  backgroundColor: activePresetId === preset.id ? undefined : 'action.hover'
                }
              }}
              onDelete={() => onPresetDelete(preset.id)}
              deleteIcon={
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPreset(preset);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPresetDelete(preset.id);
                    }}
                    sx={{ p: 0.5 }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Stack>
              }
            />
          )
        ))}
      </Stack>

      {/* Add Preset Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)}>
        <DialogTitle>Add New Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset Name"
            fullWidth
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddPreset();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddPreset} color="primary">
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PresetManager; 