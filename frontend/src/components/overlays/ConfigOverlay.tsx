import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Slider,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SoundFile, Environment } from '../../types/audio';
import FileManagerDialog from '../dialogs/FileManagerDialog';
import { deleteFile, listFiles } from '../../services/fileService';

export interface ConfigOverlayProps {
  open: boolean;
  onClose: () => void;
  environments: Environment[];
  onEnvironmentUpdate: (environment: Environment) => void;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  soundFiles: SoundFile[];
  onSoundFilesChange: (files: SoundFile[]) => void;
}

const ConfigOverlay: React.FC<ConfigOverlayProps> = ({
  open,
  onClose,
  environments,
  onEnvironmentUpdate,
  masterVolume,
  onMasterVolumeChange,
  soundFiles,
  onSoundFilesChange,
}) => {
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [localSoundFiles, setLocalSoundFiles] = useState(soundFiles);

  const refreshFiles = async () => {
    try {
      const files = await listFiles();
      onSoundFilesChange(files);
    } catch (error) {
      console.error('Failed to refresh sound files:', error);
    }
  };

  // Keep local state in sync with props
  useEffect(() => {
    setLocalSoundFiles(soundFiles);
  }, [soundFiles]);

  // Initial load and refresh when overlay becomes visible
  useEffect(() => {
    refreshFiles();
  }, []); // Run on mount

  // Refresh sound files when the file manager is opened
  useEffect(() => {
    if (isFileManagerOpen) {
      refreshFiles();
    }
  }, [isFileManagerOpen]);

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      await refreshFiles(); // Use the shared refresh function
    } catch (error) {
      console.error('Failed to delete file:', error);
      // TODO: Show error notification
    }
  };

  const handleOpenFileManager = () => {
    setIsFileManagerOpen(true);
  };

  const handleCloseFileManager = () => {
    setIsFileManagerOpen(false);
    refreshFiles(); // Refresh when closing the manager
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Configuration</DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h2">
              Configuration
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Master Volume */}
          <Box>
            <Typography gutterBottom>
              Master Volume ({Math.round(masterVolume * 100)}%)
            </Typography>
            <Slider
              value={masterVolume}
              onChange={(_, value) => onMasterVolumeChange(value as number)}
              min={0}
              max={1}
              step={0.01}
              aria-label="Master Volume"
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
            />
          </Box>

          {/* File Management */}
          <Button
            variant="outlined"
            onClick={handleOpenFileManager}
            sx={{ justifyContent: 'space-between' }}
          >
            <span>Manage Sound Files</span>
            <Typography variant="caption" color="text.secondary">
              ({localSoundFiles.length} files)
            </Typography>
          </Button>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={onClose}>Close</Button>
          </Box>
        </Stack>
      </DialogContent>

      <FileManagerDialog
        open={isFileManagerOpen}
        onClose={handleCloseFileManager}
        soundFiles={localSoundFiles}
        onDeleteFile={handleDeleteFile}
      />
    </Dialog>
  );
};

export default ConfigOverlay; 