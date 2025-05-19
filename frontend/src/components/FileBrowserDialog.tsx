import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  TextField,
  Typography,
  Box,
  CircularProgress,
} from '@mui/material';
import { PlayArrow, Stop, Check } from '@mui/icons-material';
import { SoundFile } from '../types/audio';
import { getFileUrl } from '../services/fileService';

interface FileBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (file: SoundFile) => void;
  soundFiles: SoundFile[];
}

export const FileBrowserDialog: React.FC<FileBrowserDialogProps> = ({
  open,
  onClose,
  onSelect,
  soundFiles = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [open]);

  const filteredFiles = searchQuery
    ? soundFiles.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : soundFiles;

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handlePlay = async (file: SoundFile) => {
    try {
      if (playingFile === file.id) {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        setPlayingFile(null);
      } else {
        if (audioRef.current) {
          audioRef.current.pause();
        }
        const audio = new Audio(getFileUrl(file.id));
        audio.addEventListener('ended', () => setPlayingFile(null));
        audioRef.current = audio;
        await audio.play();
        setPlayingFile(file.id);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
    }
  };

  const formatDuration = (ms: number | undefined): string => {
    if (typeof ms !== 'number' || isNaN(ms)) {
      return 'Unknown';
    }
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select Audio File</DialogTitle>
      <DialogContent>
        <Box mb={2}>
          <TextField
            fullWidth
            label="Search files"
            variant="outlined"
            value={searchQuery}
            onChange={handleSearch}
            margin="normal"
          />
        </Box>
        
        <List>
          {filteredFiles.map((file) => (
            <ListItem key={file.id} divider>
              <ListItemText
                primary={file.name}
                secondary={
                  <>
                    <Typography variant="body2" component="span">
                      Duration: {formatDuration(file.duration_ms)}
                    </Typography>
                    <br />
                    <Typography variant="body2" component="span">
                      Volume: {typeof file.peak_volume === 'number' ? file.peak_volume.toFixed(2) : 'Unknown'}
                    </Typography>
                  </>
                }
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  onClick={() => handlePlay(file)}
                  aria-label={playingFile === file.id ? "Stop" : "Play"}
                >
                  {playingFile === file.id ? <Stop /> : <PlayArrow />}
                </IconButton>
                <IconButton
                  edge="end"
                  onClick={() => onSelect(file)}
                  aria-label="Select"
                >
                  <Check />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 