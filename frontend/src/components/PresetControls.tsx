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
  IconButton,
  Typography,
  Paper,
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

  const handleModeChange = (event: React.MouseEvent<HTMLElement>, newMode: Mode | null) => {
    if (newMode !== null) {
      setMode(newMode);
    }
  };

  const handleAddPreset = () => {
    if (!newPresetName.trim()) return;

    const newPreset: Preset = {
      id: generateId(),
      name: newPresetName.trim(),
      layers: []
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

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const items = Array.from(presets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    onPresetsReorder(items);
  };

  const handlePresetClick = (preset: Preset) => {
    switch (mode) {
      case 'delete':
        onPresetDelete(preset.id);
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

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size="small"
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

        <Button
          startIcon={<AddIcon />}
          onClick={() => setShowAddDialog(true)}
          variant="outlined"
          size="small"
        >
          Add Preset
        </Button>
      </Box>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="presets">
          {(provided) => (
            <Box
              {...provided.droppableProps}
              ref={provided.innerRef}
              sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
            >
              {/* Default Preset */}
              <Paper
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  bgcolor: activePresetId === undefined ? 'primary.main' : 'background.paper',
                  color: activePresetId === undefined ? 'primary.contrastText' : 'text.primary',
                }}
                onClick={() => onPresetSelect(undefined)}
              >
                <Typography>Default Preset</Typography>
              </Paper>

              {/* User Presets */}
              {presets.map((preset, index) => (
                <Draggable
                  key={preset.id}
                  draggableId={preset.id}
                  index={index}
                  isDragDisabled={mode !== 'rearrange'}
                >
                  {(provided, snapshot) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        cursor: mode === 'rearrange' ? 'move' : 'pointer',
                        bgcolor: activePresetId === preset.id ? 'primary.main' : 'background.paper',
                        color: activePresetId === preset.id ? 'primary.contrastText' : 'text.primary',
                        opacity: snapshot.isDragging ? 0.8 : 1,
                      }}
                      onClick={() => handlePresetClick(preset)}
                    >
                      {mode === 'rearrange' && (
                        <IconButton
                          size="small"
                          {...provided.dragHandleProps}
                          sx={{ mr: 1 }}
                        >
                          <DragIndicatorIcon />
                        </IconButton>
                      )}
                      <Typography>{preset.name}</Typography>
                    </Paper>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Box>
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
    </Box>
  );
};

export default PresetControls; 