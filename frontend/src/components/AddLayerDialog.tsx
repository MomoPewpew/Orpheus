import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Tab,
  Tabs,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Upload, AudioFile as AudioFileIcon } from '@mui/icons-material';
import { Layer } from '../types/audio';
import { AudioFile, uploadFile } from '../services/fileService';
import { FileBrowserDialog } from './FileBrowserDialog';
import { generateId } from '../utils/ids';

interface AddLayerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (layer: Layer) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`layer-tabpanel-${index}`}
      aria-labelledby={`layer-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const AddLayerDialog: React.FC<AddLayerDialogProps> = ({
  open,
  onClose,
  onAdd,
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [layerName, setLayerName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Set layer name to file name without extension
      setLayerName(file.name.split('.').slice(0, -1).join('.'));
    }
  };

  const handleExistingFileSelect = (file: AudioFile) => {
    setShowFileBrowser(false);
    // Create layer with existing file
    const newLayer: Layer = {
      id: generateId(),
      name: layerName || file.name.split('.').slice(0, -1).join('.'),
      sounds: [
        {
          fileId: file.id,
          weight: 1,
          volume: 0.8
        }
      ],
      chance: 1,
      cooldownMs: 0,
      loopLengthMs: 0,
      weight: 1
    };
    onAdd(newLayer);
    resetAndClose();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError(null);
      const uploadedFile = await uploadFile(selectedFile, layerName);
      
      // Create new layer with uploaded file
      const newLayer: Layer = {
        id: generateId(),
        name: layerName || uploadedFile.name.split('.').slice(0, -1).join('.'),
        sounds: [
          {
            fileId: uploadedFile.id,
            weight: 1,
            volume: 0.8
          }
        ],
        chance: 1,
        cooldownMs: 0,
        loopLengthMs: 0,
        weight: 1
      };
      onAdd(newLayer);
      resetAndClose();
    } catch (error) {
      setError('Failed to upload file');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const resetAndClose = () => {
    setLayerName('');
    setSelectedFile(null);
    setActiveTab(0);
    setError(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Layer</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Layer Name"
            fullWidth
            value={layerName}
            onChange={(e) => setLayerName(e.target.value)}
          />
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="Upload New File" />
              <Tab label="Select Existing File" />
            </Tabs>
          </Box>
          <TabPanel value={activeTab} index={0}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <input
                type="file"
                accept="audio/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <IconButton
                color="primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                sx={{ width: 80, height: 80 }}
              >
                <Upload sx={{ width: 40, height: 40 }} />
              </IconButton>
              <Typography>
                {selectedFile
                  ? selectedFile.name
                  : 'Click to select an audio file'}
              </Typography>
              {error && (
                <Typography color="error" variant="body2">
                  {error}
                </Typography>
              )}
            </Box>
          </TabPanel>
          <TabPanel value={activeTab} index={1}>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <IconButton
                color="primary"
                onClick={() => setShowFileBrowser(true)}
                sx={{ width: 80, height: 80 }}
              >
                <AudioFileIcon sx={{ width: 40, height: 40 }} />
              </IconButton>
              <Typography>Browse existing audio files</Typography>
            </Box>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetAndClose}>Cancel</Button>
          {activeTab === 0 && (
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              variant="contained"
            >
              {uploading ? <CircularProgress size={24} /> : 'Upload & Add Layer'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <FileBrowserDialog
        open={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={handleExistingFileSelect}
      />
    </>
  );
};

export default AddLayerDialog; 