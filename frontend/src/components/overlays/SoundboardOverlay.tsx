import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Typography,
  Box,
  Button,
  Divider,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Environment, SoundFile } from '../../types/audio';
import AddLayerDialog from '../AddLayerDialog';

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
  const [showAddEnvironmentSound, setShowAddEnvironmentSound] = React.useState(false);
  const [showAddGlobalSound, setShowAddGlobalSound] = React.useState(false);

  const handlePlaySound = (soundId: string) => {
    // TODO: Implement sound playback
    console.log('Playing sound:', soundId);
  };

  const renderSoundButton = (soundId: string) => {
    const sound = soundFiles.find(s => s.id === soundId);
    if (!sound) return null;

    return (
      <Button
        key={soundId}
        variant="outlined"
        onClick={() => handlePlaySound(soundId)}
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
        }}
      >
        <PlayArrowIcon />
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
  };

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            maxHeight: '80vh',
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Soundboard
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Environment Sounds */}
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
            <Grid container spacing={2}>
              {environment.soundboard.map(soundId => (
                <Grid item key={soundId}>
                  {renderSoundButton(soundId)}
                </Grid>
              ))}
            </Grid>
          </Box>

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
            <Grid container spacing={2}>
              {globalSoundboard.map(soundId => (
                <Grid item key={soundId}>
                  {renderSoundButton(soundId)}
                </Grid>
              ))}
            </Grid>
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
        />
      )}
    </>
  );
};

export default SoundboardOverlay; 