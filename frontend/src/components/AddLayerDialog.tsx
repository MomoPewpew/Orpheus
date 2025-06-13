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
import { Layer, SoundFile } from '../types/audio';
import { uploadFile } from '../services/fileService';
import { FileBrowserDialog } from './FileBrowserDialog';
import { generateId } from '../utils/ids';
import { LayerMode } from '../types/audio';

interface AddLayerDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (layer: Layer) => void;
  soundFiles: SoundFile[];
  onSoundFilesChange?: (soundFiles: SoundFile[]) => void;
  mode?: 'layer' | 'sound';
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
  soundFiles = [],
  onSoundFilesChange,
  mode = 'layer'
}) => {
  const [activeTab, setActiveTab] = useState(0);
  const [layerName, setLayerName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | SoundFile | null>(null);
  const [loopLengthMs, setLoopLengthMs] = useState<number | null>(null);
  const [defaultDurationMs, setDefaultDurationMs] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    // Clear selected file when switching tabs
    setSelectedFile(null);
    setLoopLengthMs(null);
    setDefaultDurationMs(null);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Reset the duration states
      setDefaultDurationMs(null);
      setLoopLengthMs(null);
      
      // Only set name to file name if the current name is empty
      if (!layerName) {
        setLayerName(file.name.split('.').slice(0, -1).join('.'));
      }

      // Get audio duration from the file
      const audio = new Audio();
      const objectUrl = URL.createObjectURL(file);
      audio.src = objectUrl;
      
      audio.addEventListener('loadedmetadata', () => {
        const durationMs = Math.round(audio.duration * 1000);
        setDefaultDurationMs(durationMs);
        setLoopLengthMs(durationMs);
        URL.revokeObjectURL(objectUrl);
      });
    }
  };

  const handleExistingFileSelect = (file: SoundFile) => {
    setShowFileBrowser(false);
    setSelectedFile(file);
    setDefaultDurationMs(file.duration_ms);
    setLoopLengthMs(file.duration_ms);
    // Only set name to file name if the current name is empty
    if (!layerName) {
      setLayerName(file.name);
    }
  };

  // Type guards
  const isSoundFile = (file: File | SoundFile): file is SoundFile => {
    return 'id' in file && 'duration_ms' in file;
  };

  const isFile = (file: File | SoundFile): file is File => {
    return 'type' in file && 'size' in file;
  };

  const handleConfirm = () => {
    if (!selectedFile) return;

    if (!isSoundFile(selectedFile)) {
      console.error('Selected file is not a SoundFile');
      return;
    }

    // Create layer with existing file
    const newLayer: Layer = {
      id: generateId(),
      name: mode === 'layer' ? (layerName || selectedFile.name) : selectedFile.name,
      sounds: [
        {
          id: generateId(),
          fileId: selectedFile.id,
          frequency: 1,
          volume: 1
        }
      ],
      chance: 1,
      cooldownCycles: 0,
      loopLengthMs: loopLengthMs ?? selectedFile.duration_ms,
      weight: 1,
      volume: 1,
      mode: LayerMode.Shuffle,
      selectedSoundIndex: 0  // Always start with the first sound selected
    };
    onAdd(newLayer);
    resetAndClose();
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    if (!isFile(selectedFile)) {
      console.error('Selected file is not a File object');
      return;
    }

    try {
      setUploading(true);
      setError(null);
      const uploadedFile = await uploadFile(selectedFile, layerName);
      
      // Create new layer with uploaded file
      const newLayer: Layer = {
        id: generateId(),
        name: mode === 'layer' ? (layerName || uploadedFile.name.split('.').slice(0, -1).join('.')) : uploadedFile.name,
        sounds: [
          {
            id: generateId(),
            fileId: uploadedFile.id,
            frequency: 1,
            volume: 1
          }
        ],
        chance: 1,
        cooldownCycles: 0,
        loopLengthMs: loopLengthMs ?? uploadedFile.duration_ms,
        weight: 1,
        volume: 1,
        mode: LayerMode.Shuffle,
        selectedSoundIndex: 0  // Always start with the first sound selected
      };

      // Add the new file to the soundFiles list
      const updatedSoundFiles = [...soundFiles, uploadedFile];
      onSoundFilesChange?.(updatedSoundFiles);

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
    setLoopLengthMs(null);
    setDefaultDurationMs(null);
    setActiveTab(0);
    setError(null);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={resetAndClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {mode === 'layer' ? 'Add New Layer' : 'Add Sound'}
        </DialogTitle>
        <DialogContent>
          {/* Show name textbox at top in both modes when in upload tab */}
          {(mode === 'layer' || activeTab === 0) && (
            <TextField
              autoFocus
              margin="dense"
              label={mode === 'layer' ? 'Layer Name' : 'Sound Name'}
              fullWidth
              value={layerName}
              onChange={(e) => setLayerName(e.target.value)}
              sx={{ mb: 2 }}
              helperText={
                mode === 'layer' 
                  ? (activeTab === 0 ? "This name will be used for both the layer and the sound" : undefined)
                  : "Leave empty to use file name"
              }
            />
          )}

          {/* Loop Length field - only show in layer mode */}
          {mode === 'layer' && selectedFile && (
            <TextField
              type="number"
              margin="dense"
              label="Loop Length (ms)"
              fullWidth
              value={loopLengthMs ?? ''}
              onChange={(e) => setLoopLengthMs(e.target.value ? Number(e.target.value) : null)}
              sx={{ mb: 2 }}
              helperText={`Default: ${
                defaultDurationMs !== null
                  ? defaultDurationMs
                  : 'Calculating...'
              } ms`}
            />
          )}

          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
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
              {selectedFile && (
                <Typography variant="body2" color="primary">
                  Selected: {selectedFile.name}
                </Typography>
              )}
            </Box>
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={resetAndClose}>Cancel</Button>
          {activeTab === 0 ? (
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              variant="contained"
            >
              {uploading ? <CircularProgress size={24} /> : (mode === 'layer' ? 'Upload & Add Layer' : 'Upload & Add Sound')}
            </Button>
          ) : (
            <Button
              onClick={handleConfirm}
              disabled={!selectedFile}
              variant="contained"
            >
              {mode === 'layer' ? 'Add Layer' : 'Add Sound'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      <FileBrowserDialog
        open={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={handleExistingFileSelect}
        soundFiles={soundFiles}
      />
    </>
  );
};

export default AddLayerDialog; 