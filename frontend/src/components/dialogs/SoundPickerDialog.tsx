import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
} from '@mui/material';
import { SoundFile } from '../../types/audio';

interface SoundPickerDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (soundFileId: string) => void;
  soundFiles: SoundFile[];
}

export const SoundPickerDialog: React.FC<SoundPickerDialogProps> = ({
  open,
  onClose,
  onSelect,
  soundFiles,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Sound</DialogTitle>
      <DialogContent>
        <List>
          {soundFiles.map((soundFile) => (
            <ListItem key={soundFile.id} disablePadding>
              <ListItemButton onClick={() => {
                onSelect(soundFile.id);
                onClose();
              }}>
                <ListItemText primary={soundFile.name} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}; 