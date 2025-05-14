import React, { useState, useEffect, useMemo } from 'react';
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
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SoundFile, Environment, Effects } from '../../types/audio';
import FileManagerDialog from '../dialogs/FileManagerDialog';
import { deleteFile, listFiles } from '../../services/fileService';

interface CompressorVisualizerProps {
  lowThreshold: number;
  highThreshold: number;
  ratio: number;
  width?: number;
  height?: number;
}

const CompressorVisualizer: React.FC<CompressorVisualizerProps> = ({
  lowThreshold,
  highThreshold,
  ratio,
  width = 300,
  height = 200,
}) => {
  // Constants for dB range and conversion
  const dbRange = 60; // -50 to +10 = 60dB range
  const dbMin = -50;
  const dbMax = 10;
  
  // Convert dB to SVG coordinate (0-1)
  const dbToNormalized = (db: number) => (db - dbMin) / dbRange;
  
  const points = useMemo(() => {
    // Generate points for the curve
    const numPoints = 200;
    const points: [number, number][] = [];
    
    // Calculate points from -50dB to +10dB
    for (let i = 0; i <= numPoints; i++) {
      const inputDb = dbMin + (i * dbRange / numPoints);
      let outputDb;

      if (inputDb <= lowThreshold) {
        // Below low threshold
        const dbUnderLow = inputDb - lowThreshold;
        const compressedDbUnderLow = dbUnderLow / ratio;
        outputDb = lowThreshold + compressedDbUnderLow;
      } else if (inputDb >= highThreshold) {
        // Above high threshold
        const dbOverHigh = inputDb - highThreshold;
        const compressedDbOverHigh = dbOverHigh / ratio;
        outputDb = highThreshold + compressedDbOverHigh;
      } else {
        // Linear between thresholds (1:1)
        outputDb = inputDb;
      }

      // Convert to SVG coordinates (0-1)
      const x = dbToNormalized(inputDb);
      const y = 1 - dbToNormalized(outputDb); // Invert Y axis

      points.push([x, y]);
    }

    return points;
  }, [lowThreshold, highThreshold, ratio]);

  // Create SVG path with scaled coordinates
  const pathD = useMemo(() => {
    return `M ${points.map(([x, y]) => `${x * width},${y * height}`).join(' L ')}`;
  }, [points, width, height]);

  return (
    <Box sx={{ position: 'relative', width: '100%', paddingBottom: '75%', margin: '0 auto' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: '20px 40px 30px 40px' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
          {/* Vertical grid lines (every 10dB) */}
          {Array.from({ length: 7 }, (_, i) => {
            const db = dbMin + i * 10;
            const x = dbToNormalized(db) * width;
            return (
              <React.Fragment key={`v-${i}`}>
                <line
                  x1={x}
                  y1={0}
                  x2={x}
                  y2={height}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={height - 2}
                  fontSize={10}
                  textAnchor="middle"
                  fill="rgba(0,0,0,0.5)"
                >
                  {db}dB
                </text>
              </React.Fragment>
            );
          })}
          
          {/* Horizontal grid lines (every 10dB) */}
          {Array.from({ length: 7 }, (_, i) => {
            const db = dbMax - i * 10;
            const y = (1 - dbToNormalized(db)) * height;
            return (
              <React.Fragment key={`h-${i}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={width}
                  y2={y}
                  stroke="rgba(0,0,0,0.1)"
                  strokeWidth={1}
                />
                <text
                  x={6}
                  y={y}
                  fontSize={10}
                  dominantBaseline="middle"
                  fill="rgba(0,0,0,0.5)"
                >
                  {db}dB
                </text>
              </React.Fragment>
            );
          })}

          {/* Threshold markers */}
          <line
            x1={dbToNormalized(lowThreshold) * width}
            y1={0}
            x2={dbToNormalized(lowThreshold) * width}
            y2={height}
            stroke="rgba(255,0,0,0.3)"
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <line
            x1={dbToNormalized(highThreshold) * width}
            y1={0}
            x2={dbToNormalized(highThreshold) * width}
            y2={height}
            stroke="rgba(255,0,0,0.3)"
            strokeWidth={1}
            strokeDasharray="4,4"
          />

          {/* Response curve */}
          <path
            d={pathD}
            stroke="#2196f3"
            strokeWidth={2}
            fill="none"
          />
        </svg>
      </Box>
    </Box>
  );
};

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
  
  // Effect chain states with default values
  const [normalizeVolume, setNormalizeVolume] = useState(true);
  const [fadeInDuration, setFadeInDuration] = useState(4000);
  const [crossfadeDuration, setCrossfadeDuration] = useState(4000);
  const [highPassFreq, setHighPassFreq] = useState(400);
  const [lowPassFreq, setLowPassFreq] = useState(10000);
  const [dampenSpeechRange, setDampenSpeechRange] = useState(0);
  
  // Glue compressor states with default values
  const [compressorLowThreshold, setCompressorLowThreshold] = useState(-40);
  const [compressorHighThreshold, setCompressorHighThreshold] = useState(0);
  const [compressorRatio, setCompressorRatio] = useState(1);

  const refreshFiles = async () => {
    try {
      const files = await listFiles();
      onSoundFilesChange(files);
    } catch (error) {
      console.error('Failed to refresh sound files:', error);
    }
  };

  useEffect(() => {
    setLocalSoundFiles(soundFiles);
  }, [soundFiles]);

  useEffect(() => {
    refreshFiles();
  }, []);

  useEffect(() => {
    if (isFileManagerOpen) {
      refreshFiles();
    }
  }, [isFileManagerOpen]);

  const handleDeleteFile = async (fileId: string) => {
    try {
      await deleteFile(fileId);
      await refreshFiles();
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const handleOpenFileManager = () => {
    setIsFileManagerOpen(true);
  };

  const handleCloseFileManager = () => {
    setIsFileManagerOpen(false);
    refreshFiles();
  };

  const handleApply = async () => {
    try {
      // Update master volume separately since it's not part of the Environment type
      onMasterVolumeChange(masterVolume);

      // Create effects configuration
      const effects: Effects = {
        normalize: {
          enabled: normalizeVolume
        },
        fades: {
          fadeInDuration,
          crossfadeDuration
        },
        filters: {
          highPass: {
            frequency: highPassFreq
          },
          lowPass: {
            frequency: lowPassFreq
          },
          dampenSpeechRange: {
            amount: dampenSpeechRange
          }
        },
        compressor: {
          lowThreshold: compressorLowThreshold,
          highThreshold: compressorHighThreshold,
          ratio: compressorRatio
        }
      };

      // Update the environment with the effects settings
      await onEnvironmentUpdate({
        ...environments[0],
        effects
      });
      
      onClose();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Configuration</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
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

          <Divider />

          {/* Effects Section */}
          <Box>
            <Typography variant="h6" gutterBottom>
              Effects
            </Typography>
            
            {/* Volume Normalization */}
            <FormControlLabel
              control={
                <Switch
                  checked={normalizeVolume}
                  onChange={(e) => setNormalizeVolume(e.target.checked)}
                />
              }
              label="Normalize volume"
            />

            {/* Fade Durations */}
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <TextField
                type="number"
                label="Fade-in duration (ms)"
                value={fadeInDuration}
                onChange={(e) => setFadeInDuration(Number(e.target.value))}
                size="small"
                inputProps={{ min: 0 }}
              />
              <TextField
                type="number"
                label="Crossfade duration (ms)"
                value={crossfadeDuration}
                onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
                size="small"
                inputProps={{ min: 0 }}
              />
            </Stack>

            {/* Filters */}
            <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
              <TextField
                type="number"
                label="High-pass frequency (Hz)"
                value={highPassFreq}
                onChange={(e) => setHighPassFreq(Number(e.target.value))}
                size="small"
                inputProps={{ min: 20, max: 20000 }}
              />
              <TextField
                type="number"
                label="Low-pass frequency (Hz)"
                value={lowPassFreq}
                onChange={(e) => setLowPassFreq(Number(e.target.value))}
                size="small"
                inputProps={{ min: 20, max: 20000 }}
              />
            </Stack>

            {/* Speech Range Dampening */}
            <Box>
              <Typography gutterBottom>
                Speech Range Dampening: {Math.round(dampenSpeechRange * 100)}%
              </Typography>
              <Slider
                value={dampenSpeechRange}
                onChange={(_, value) => setDampenSpeechRange(value as number)}
                min={0}
                max={1}
                step={0.05}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => `${Math.round(value * 100)}%`}
              />
            </Box>

            {/* Glue Compressor */}
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Glue Compressor
              </Typography>
              
              <CompressorVisualizer
                lowThreshold={compressorLowThreshold}
                highThreshold={compressorHighThreshold}
                ratio={compressorRatio}
              />

              <Stack spacing={2}>
                <Box>
                  <Typography gutterBottom>
                    Low Threshold: {compressorLowThreshold} dB
                  </Typography>
                  <Slider
                    value={compressorLowThreshold}
                    onChange={(_, value) => setCompressorLowThreshold(Math.min(compressorHighThreshold, value as number))}
                    min={-40}
                    max={0}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value} dB`}
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>
                    High Threshold: {compressorHighThreshold} dB
                  </Typography>
                  <Slider
                    value={compressorHighThreshold}
                    onChange={(_, value) => setCompressorHighThreshold(Math.max(compressorLowThreshold, value as number))}
                    min={-40}
                    max={0}
                    step={1}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value} dB`}
                  />
                </Box>

                <Box>
                  <Typography gutterBottom>
                    Ratio: {compressorRatio}:1
                  </Typography>
                  <Slider
                    value={compressorRatio}
                    onChange={(_, value) => setCompressorRatio(value as number)}
                    min={1}
                    max={20}
                    step={0.5}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => `${value}:1`}
                  />
                </Box>
              </Stack>
            </Paper>
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={onClose}>Close</Button>
            <Button variant="contained" color="primary" onClick={handleApply}>
              Apply
            </Button>
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