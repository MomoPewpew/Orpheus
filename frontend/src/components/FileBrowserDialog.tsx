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
import { listFiles } from '../services/fileService';

interface AudioFile {
  id: string;
  name: string;
  path: string;
  peak_volume: number;
  duration_ms: number;
  original_filename: string;
}

interface FileBrowserDialogProps {
  open: boolean;
  onClose: () => void;
  onSelect: (file: AudioFile) => void;
}

export const FileBrowserDialog: React.FC<FileBrowserDialogProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (open) {
      loadFiles();
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [open]);

  const loadFiles = async (query: string = '') => {
    try {
      setLoading(true);
      setError(null);
      const response = await listFiles(query);
      setFiles(response);
    } catch (err) {
      setError('Failed to load audio files');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);
    loadFiles(query);
  };

  const handlePlay = async (file: AudioFile) => {
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
        const audio = new Audio(`/api/files/${file.id}`);
        audio.addEventListener('ended', () => setPlayingFile(null));
        audioRef.current = audio;
        await audio.play();
        setPlayingFile(file.id);
      }
    } catch (err) {
      console.error('Error playing audio:', err);
      setError('Failed to play audio file');
    }
  };

  const formatDuration = (ms: number): string => {
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
        
        {error && (
          <Typography color="error" gutterBottom>
            {error}
          </Typography>
        )}
        
        {loading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : (
          <List>
            {files.map((file) => (
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
                        Peak Volume: {file.peak_volume.toFixed(2)}
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
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}; 