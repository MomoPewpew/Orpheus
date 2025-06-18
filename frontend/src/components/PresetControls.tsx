import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon,
  Edit as EditIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { Preset, Environment } from '../types/audio';
import { generateId } from '../utils/ids';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

interface PresetControlsProps {
  environment: Environment;
  presets: Preset[];
  activePresetId?: string;  // undefined means default preset
  onPresetAdd: (preset: Preset) => void;
  onPresetUpdate: (preset: Preset) => void;
  onPresetDelete: (presetId: string) => void;
  onPresetSelect: (presetId: string | undefined) => void;
  onPresetsReorder: (presets: Preset[]) => void;
}

type Mode = 'play' | 'delete' | 'rename' | 'rearrange';

export const PresetControls: React.FC<PresetControlsProps> = ({
  environment,
  presets,
  activePresetId,
  onPresetAdd,
  onPresetUpdate,
  onPresetDelete,
  onPresetSelect,
  onPresetsReorder,
}) => {
  const [mode, setMode] = useState<Mode>('play');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [presetToRename, setPresetToRename] = useState<Preset | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<Preset | null>(null);

  const handleModeChange = (event: React.MouseEvent<HTMLElement>, newMode: Mode | null) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(presets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    onPresetsReorder(items);
  };

  const handleAddPreset = () => {
    if (!newPresetName.trim()) return;

    const basePreset = activePresetId 
      ? presets.find(p => p.id === activePresetId)
      : undefined;

    const newPreset: Preset = {
      id: generateId(),
      name: newPresetName.trim(),
      layers: basePreset?.layers ?? [],
      maxWeight: basePreset?.maxWeight
    };

    onPresetAdd(newPreset);
    setNewPresetName('');
    setShowAddDialog(false);
  };

  const handleRenamePreset = () => {
    if (!presetToRename || !newPresetName.trim()) return;

    const updatedPreset: Preset = {
      ...presetToRename,
      name: newPresetName.trim()
    };

    onPresetUpdate(updatedPreset);
    setNewPresetName('');
    setPresetToRename(null);
    setShowRenameDialog(false);
  };

  const handlePresetClick = (preset: Preset) => {
    switch (mode) {
      case 'delete':
        setPresetToDelete(preset);
        setShowDeleteDialog(true);
        break;
      case 'rename':
        setPresetToRename(preset);
        setNewPresetName(preset.name);
        setShowRenameDialog(true);
        break;
      case 'play':
        onPresetSelect(preset.id);
        break;
    }
  };

  const handleDeleteConfirm = () => {
    if (presetToDelete) {
      onPresetDelete(presetToDelete.id);
      setPresetToDelete(null);
    }
    setShowDeleteDialog(false);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Click modes row */}
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        mb: 2 
      }}>
        <Typography variant="h6">Presets</Typography>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              borderRadius: 1,
            }
          }}
        >
          <ToggleButton value="play">
            <PlayArrowIcon />
          </ToggleButton>
          <ToggleButton value="delete">
            <DeleteIcon />
          </ToggleButton>
          <ToggleButton value="rename">
            <EditIcon />
          </ToggleButton>
          <ToggleButton value="rearrange">
            <DragIndicatorIcon />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Presets row */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="presets" direction="horizontal">
          {(provided) => (
            <Stack 
              direction="row" 
              spacing={1} 
              sx={{ 
                overflowX: 'auto',
                pb: 1,
                flexWrap: 'nowrap',
                minHeight: 32
              }}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {/* Default preset */}
              <Chip
                label="Default"
                onClick={() => onPresetSelect(undefined)}
                color={activePresetId === undefined ? "primary" : "default"}
                variant={activePresetId === undefined ? "filled" : "outlined"}
                sx={{ 
                  minWidth: 80,
                  borderRadius: 1,
                  '&:hover': {
                    backgroundColor: activePresetId === undefined ? undefined : 'action.hover'
                  }
                }}
              />

              {/* User presets */}
              {presets.map((preset, index) => (
                <Draggable 
                  key={preset.id} 
                  draggableId={preset.id} 
                  index={index}
                  isDragDisabled={mode !== 'rearrange'}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      style={{
                        ...provided.draggableProps.style,
                        opacity: snapshot.isDragging ? 0.8 : 1,
                      }}
                    >
                      <Chip
                        label={preset.name}
                        onClick={() => handlePresetClick(preset)}
                        color={activePresetId === preset.id ? "primary" : "default"}
                        variant={activePresetId === preset.id ? "filled" : "outlined"}
                        sx={{ 
                          minWidth: 80,
                          borderRadius: 1,
                          '&:hover': {
                            backgroundColor: activePresetId === preset.id ? undefined : 'action.hover'
                          }
                        }}
                      />
                    </div>
                  )}
                </Draggable>
              ))}

              {provided.placeholder}

              {/* Add preset button */}
              <Button
                startIcon={<AddIcon />}
                onClick={() => setShowAddDialog(true)}
                variant="outlined"
                size="small"
                sx={{ 
                  minWidth: 120,
                  borderRadius: 1,
                }}
              >
                Add Preset
              </Button>
            </Stack>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Preset Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => {
          setShowAddDialog(false);
          setNewPresetName('');
        }}
        maxWidth="sm"
        fullWidth
      >
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
          <Button onClick={() => setShowAddDialog(false)}>Cancel</Button>
          <Button onClick={handleAddPreset} variant="contained" disabled={!newPresetName.trim()}>
            Add Preset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Preset Dialog */}
      <Dialog
        open={showRenameDialog}
        onClose={() => {
          setShowRenameDialog(false);
          setNewPresetName('');
          setPresetToRename(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Rename Preset</DialogTitle>
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
          <Button onClick={() => setShowRenameDialog(false)}>Cancel</Button>
          <Button onClick={handleRenamePreset} variant="contained" disabled={!newPresetName.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => {
          setShowDeleteDialog(false);
          setPresetToDelete(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Delete Preset</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete preset "{presetToDelete?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PresetControls; 