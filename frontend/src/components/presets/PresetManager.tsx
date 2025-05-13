import React, { useState, MouseEvent } from 'react';
import { Layer, Preset, Environment } from '../../types/audio';
import { generateId } from '../../utils/ids';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

interface PresetManagerProps {
  presets: Preset[];
  environment: Environment;
  activePresetId?: string;
  onPresetCreate: (preset: Preset) => void;
  onPresetUpdate: (preset: Preset) => void;
  onPresetDelete: (presetId: string) => void;
  onPresetSelect: (presetId: string | undefined) => void;
}

export const PresetManager: React.FC<PresetManagerProps> = ({
  presets,
  environment,
  activePresetId,
  onPresetCreate,
  onPresetUpdate,
  onPresetDelete,
  onPresetSelect,
}: PresetManagerProps) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: Preset = {
      id: generateId(),
      name: newPresetName.trim(),
      layers: [],
      isDefault: false
    };

    onPresetCreate(newPreset);
    setNewPresetName('');
    setIsAddDialogOpen(false);
  };

  const handleUpdatePreset = () => {
    if (!editingPreset || !editingPreset.name.trim()) return;
    onPresetUpdate(editingPreset);
    setEditingPreset(null);
  };

  const handleEditClick = (e: MouseEvent<SVGSVGElement>, preset: Preset) => {
    e.stopPropagation();
    setEditingPreset(preset);
  };

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Typography variant="h6">Presets</Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setIsAddDialogOpen(true)}
        >
          Add Preset
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap">
        {presets.map(preset => (
          <Chip
            key={preset.id}
            label={preset.name}
            onClick={() => onPresetSelect(preset.id === activePresetId ? undefined : preset.id)}
            onDelete={() => onPresetDelete(preset.id)}
            color={preset.id === activePresetId ? "primary" : "default"}
            deleteIcon={
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <EditIcon
                  onClick={(e) => handleEditClick(e, preset)}
                  sx={{ cursor: 'pointer' }}
                />
                <DeleteIcon />
              </Box>
            }
          />
        ))}
      </Stack>

      {/* Add Preset Dialog */}
      <Dialog open={isAddDialogOpen} onClose={() => setIsAddDialogOpen(false)}>
        <DialogTitle>Add New Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset Name"
            fullWidth
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreatePreset} disabled={!newPresetName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Preset Dialog */}
      <Dialog open={!!editingPreset} onClose={() => setEditingPreset(null)}>
        <DialogTitle>Edit Preset</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Preset Name"
            fullWidth
            value={editingPreset?.name || ''}
            onChange={(e) => editingPreset && setEditingPreset({
              ...editingPreset,
              name: e.target.value
            })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditingPreset(null)}>Cancel</Button>
          <Button onClick={handleUpdatePreset} disabled={!editingPreset?.name.trim()}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PresetManager; 