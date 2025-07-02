import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Environment, SoundFile } from '../../types/audio';
import AddLayerDialog from '../AddLayerDialog';
import { DragDropContext, Draggable, Droppable, DropResult } from '@hello-pangea/dnd';

type Mode = 'play' | 'delete' | 'rearrange';

const API_BASE = process.env.REACT_APP_API_URL || 'http://0.0.0.0:5000/api';
const API_SOUNDBOARD = `${API_BASE}/soundboard/play`;

interface SoundboardOverlayProps {
  environment: Environment;
  onClose: () => void;
  soundFiles: SoundFile[];
  globalSoundboard: string[];
  onSoundFilesChange: (files: SoundFile[]) => void;
  onEnvironmentUpdate: (environment: Environment) => void;
  onGlobalSoundboardChange: (soundIds: string[]) => void;
}

export const SoundboardOverlay: React.FC<SoundboardOverlayProps> = ({
  environment,
  onClose,
  soundFiles,
  globalSoundboard,
  onSoundFilesChange,
  onEnvironmentUpdate,
  onGlobalSoundboardChange,
}) => {
  const [showAddEnvironmentSound, setShowAddEnvironmentSound] = useState(false);
  const [showAddGlobalSound, setShowAddGlobalSound] = useState(false);
  const [mode, setMode] = useState<Mode>('play');

  const handlePlaySound = async (soundId: string) => {
    if (mode === 'delete') {
      // Delete from environment soundboard
      const updatedEnvironment = {
        ...environment,
        soundboard: environment.soundboard.filter(id => id !== soundId)
      };
      onEnvironmentUpdate(updatedEnvironment);
      return;
    }

    if (mode === 'play') {
      // Play the sound through the backend
      try {
        await fetch(`${API_SOUNDBOARD}/${soundId}`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
  };

  const handlePlayGlobalSound = async (soundId: string) => {
    if (mode === 'delete') {
      // Delete from global soundboard
      onGlobalSoundboardChange(globalSoundboard.filter(id => id !== soundId));
      return;
    }

    if (mode === 'play') {
      // Play the sound through the backend
      try {
        await fetch(`${API_SOUNDBOARD}/${soundId}`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Failed to play sound:', error);
      }
    }
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;

    // Handle environment soundboard reordering
    if (result.type === 'environment-sound') {
      const items = Array.from(environment.soundboard);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);

      const updatedEnvironment = {
        ...environment,
        soundboard: items
      };
      onEnvironmentUpdate(updatedEnvironment);
    }

    // Handle global soundboard reordering
    if (result.type === 'global-sound') {
      const items = Array.from(globalSoundboard);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      onGlobalSoundboardChange(items);
    }
  };

  const renderSoundButton = (soundId: string, isGlobal: boolean = false, index: number) => {
    const sound = soundFiles.find(s => s.id === soundId);
    if (!sound) return null;

    // Create a unique draggableId using type, index, and soundId
    const draggableId = `${isGlobal ? 'global' : 'env'}-${index}-${soundId}`;

    const button = (
      <Button
        variant="outlined"
        onClick={() => isGlobal ? handlePlayGlobalSound(soundId) : handlePlaySound(soundId)}
        sx={{
          width: 120,
          height: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          textTransform: 'none',
          p: 1,
          position: 'relative',
        }}
      >
        {mode === 'play' && <PlayArrowIcon />}
        {mode === 'delete' && <DeleteIcon color="error" />}
        {mode === 'rearrange' && <DragIndicatorIcon />}
        <Typography
          variant="body2"
          sx={{
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {sound.name}
        </Typography>
      </Button>
    );

    if (mode === 'rearrange') {
      return (
        <Draggable 
          draggableId={draggableId}
          index={index}
        >
          {(provided) => (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
            >
              {button}
            </div>
          )}
        </Draggable>
      );
    }

    return button;
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Dialog
        open
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, flexShrink: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Soundboard</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={(_, newMode) => newMode && setMode(newMode)}
                size="small"
              >
                <ToggleButton value="play">
                  <PlayArrowIcon />
                </ToggleButton>
                <ToggleButton value="delete">
                  <DeleteIcon />
                </ToggleButton>
                <ToggleButton value="rearrange">
                  <DragIndicatorIcon />
                </ToggleButton>
              </ToggleButtonGroup>
              <IconButton onClick={onClose} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
          <Box sx={{ overflow: 'auto', flexGrow: 1 }}>
            {/* Environment Sounds */}
            {environment.id && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                    Environment Sounds
                  </Typography>
                  <Button
                    startIcon={<AddIcon />}
                    onClick={() => setShowAddEnvironmentSound(true)}
                    size="small"
                  >
                    Add Sound
                  </Button>
                </Box>
                <Droppable droppableId="environment-sounds" direction="horizontal" type="environment-sound">
                  {(provided) => (
                    <Box 
                      ref={provided.innerRef} 
                      {...provided.droppableProps}
                      sx={{ 
                        display: 'flex',
                        gap: 2,
                        overflowX: 'auto',
                        pb: 2,
                        minHeight: 140,
                        '&::-webkit-scrollbar': {
                          height: 8,
                        },
                        '&::-webkit-scrollbar-track': {
                          backgroundColor: 'rgba(0, 0, 0, 0.05)',
                          borderRadius: 4,
                        },
                        '&::-webkit-scrollbar-thumb': {
                          backgroundColor: 'rgba(0, 0, 0, 0.2)',
                          borderRadius: 4,
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.3)',
                          },
                        },
                      }}
                    >
                      {environment.soundboard.map((soundId, index) => (
                        <Box key={`env-${index}-${soundId}`} sx={{ flexShrink: 0 }}>
                          {renderSoundButton(soundId, false, index)}
                        </Box>
                      ))}
                      {provided.placeholder}
                    </Box>
                  )}
                </Droppable>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Global Sounds */}
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                  Global Sounds
                </Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={() => setShowAddGlobalSound(true)}
                  size="small"
                >
                  Add Sound
                </Button>
              </Box>
              <Droppable droppableId="global-sounds" direction="horizontal" type="global-sound">
                {(provided) => (
                  <Box 
                    ref={provided.innerRef} 
                    {...provided.droppableProps}
                    sx={{ 
                      display: 'flex',
                      gap: 2,
                      overflowX: 'auto',
                      pb: 2,
                      minHeight: 140,
                      '&::-webkit-scrollbar': {
                        height: 8,
                      },
                      '&::-webkit-scrollbar-track': {
                        backgroundColor: 'rgba(0, 0, 0, 0.05)',
                        borderRadius: 4,
                      },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: 4,
                        '&:hover': {
                          backgroundColor: 'rgba(0, 0, 0, 0.3)',
                        },
                      },
                    }}
                  >
                    {globalSoundboard.map((soundId, index) => (
                      <Box key={`global-${index}-${soundId}`} sx={{ flexShrink: 0 }}>
                        {renderSoundButton(soundId, true, index)}
                      </Box>
                    ))}
                    {provided.placeholder}
                  </Box>
                )}
              </Droppable>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Add Sound Dialogs */}
      {showAddEnvironmentSound && (
        <AddLayerDialog
          open={showAddEnvironmentSound}
          onClose={() => setShowAddEnvironmentSound(false)}
          onAdd={(newSound) => {
            if (newSound.sounds.length > 0) {
              const soundId = newSound.sounds[0].fileId;
              const updatedEnvironment = {
                ...environment,
                soundboard: [...environment.soundboard, soundId]
              };
              onEnvironmentUpdate(updatedEnvironment);
            }
            setShowAddEnvironmentSound(false);
          }}
          soundFiles={soundFiles}
          onSoundFilesChange={onSoundFilesChange}
          mode="sound"
        />
      )}

      {showAddGlobalSound && (
        <AddLayerDialog
          open={showAddGlobalSound}
          onClose={() => setShowAddGlobalSound(false)}
          onAdd={(newSound) => {
            if (newSound.sounds.length > 0) {
              const soundId = newSound.sounds[0].fileId;
              onGlobalSoundboardChange([...globalSoundboard, soundId]);
            }
            setShowAddGlobalSound(false);
          }}
          soundFiles={soundFiles}
          onSoundFilesChange={onSoundFilesChange}
          mode="sound"
        />
      )}
    </DragDropContext>
  );
};

export default SoundboardOverlay; 