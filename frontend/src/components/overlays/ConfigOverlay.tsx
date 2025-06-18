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
  DialogActions,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { SoundFile, Environment, Effects } from '../../types/audio';
import FileManagerDialog from '../dialogs/FileManagerDialog';
import { deleteFile, listFiles, getFileUrl, uploadFile } from '../../services/fileService';
import ExportDialog, { ExportSelection } from '../dialogs/ExportDialog';
import ImportDialog, { EnvironmentImportMode, ImportSelection } from '../dialogs/ImportDialog';
import JSZip from 'jszip';
import { generateId } from '../../utils/ids';
import InfoIcon from '@mui/icons-material/Info';

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
  onEffectsUpdate: (effects: Effects) => void;
  onGlobalSoundboardUpdate: (soundFileIds: string[]) => void;
  globalSoundboard: string[];
  effects: Effects;
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
  onEffectsUpdate,
  onGlobalSoundboardUpdate,
  globalSoundboard,
  effects,
}) => {
  const [isFileManagerOpen, setIsFileManagerOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isConfirmRevertOpen, setIsConfirmRevertOpen] = useState(false);
  const [localSoundFiles, setLocalSoundFiles] = useState(soundFiles);
  const [importSelection, setImportSelection] = useState<ImportSelection | null>(null);
  
  // Effect chain states with default values
  const [normalizeVolume, setNormalizeVolume] = useState(true);
  const [fadeInDuration, setFadeInDuration] = useState(4000);
  const [crossfadeDuration, setCrossfadeDuration] = useState(4000);
  const [highPassFreq, setHighPassFreq] = useState(0);
  const [lowPassFreq, setLowPassFreq] = useState(20000);
  const [dampenSpeechRange, setDampenSpeechRange] = useState(0);
  
  // Glue compressor states with default values
  const [compressorLowThreshold, setCompressorLowThreshold] = useState(-40);
  const [compressorHighThreshold, setCompressorHighThreshold] = useState(0);
  const [compressorRatio, setCompressorRatio] = useState(1);

  // Initialize effect values from props when overlay opens
  useEffect(() => {
    if (open && effects) {
      // Initialize normalize settings
      setNormalizeVolume(effects.normalize.enabled);
      
      // Initialize fade settings
      setFadeInDuration(effects.fades.fadeInDuration);
      setCrossfadeDuration(effects.fades.crossfadeDuration);
      
      // Initialize filter settings
      setHighPassFreq(effects.filters.highPass.frequency);
      setLowPassFreq(effects.filters.lowPass.frequency);
      setDampenSpeechRange(effects.filters.dampenSpeechRange.amount);
      
      // Initialize compressor settings
      setCompressorLowThreshold(effects.compressor.lowThreshold);
      setCompressorHighThreshold(effects.compressor.highThreshold);
      setCompressorRatio(effects.compressor.ratio);
    }
  }, [open, effects]);

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

      // Update workspace-level effects
      onEffectsUpdate(effects);

      // Update the environment WITHOUT the effects
      if (environments.length > 0) {
        const { effects: oldEffects, ...envWithoutEffects } = environments[0];
        await onEnvironmentUpdate({
          ...envWithoutEffects
        });
      }
      
      onClose();
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const handleExport = async (selection: ExportSelection) => {
    try {
      const zip = new JSZip();
      const dataFolder = zip.folder('data')!;
      
      // Track which sound files we need to include
      const soundFileIds = new Set<string>();

      // Helper to collect sound file IDs from an environment
      const collectSoundFileIds = (environment: Environment) => {
        console.debug('Collecting sound files from environment:', {
          envId: environment.id,
          soundboardCount: environment.soundboard.length,
          layersCount: environment.layers.length,
          soundboardIds: environment.soundboard,
          layerSounds: environment.layers.map(layer => layer.sounds.map(sound => sound.fileId))
        });
        
        // Add soundboard sounds
        environment.soundboard.forEach(id => soundFileIds.add(id));
        
        // Add sounds from layers
        environment.layers.forEach(layer => {
          layer.sounds.forEach(sound => soundFileIds.add(sound.fileId));
        });
      };

      // Handle global settings
      if (selection.globalSettings) {
        const config = {
          masterVolume,
          effects: {
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
          }
        };
        dataFolder.file('config.json', JSON.stringify(config, null, 2));
      }

      // Handle global soundboard
      if (selection.globalSoundboard) {
        console.debug('Adding global soundboard files:', {
          totalFiles: globalSoundboard.length,
          fileIds: globalSoundboard
        });
        // Add soundboard IDs to the collection
        globalSoundboard.forEach(id => soundFileIds.add(id));
        
        // Add soundboard to config.json
        const configFile = dataFolder.file('config.json');
        let config = {};
        
        if (configFile) {
          // If config.json already exists from global settings, read it
          const content = await configFile.async('string');
          config = JSON.parse(content);
        }
        
        // Add or update the soundboard in the config
        config = {
          ...config,
          soundboard: globalSoundboard
        };
        
        // Write back the updated config
        dataFolder.file('config.json', JSON.stringify(config, null, 2));
      }

      // Handle selected environments
      const environmentsFolder = dataFolder.folder('environments')!;
      console.debug('Processing selected environments:', {
        selectedIds: selection.environments,
        availableEnvs: environments.map(e => ({ id: e.id, name: e.name }))
      });
      
      for (const envId of selection.environments) {
        const environment = environments.find(env => env.id === envId);
        if (environment) {
          console.debug('Processing environment:', {
            envId,
            name: environment.name,
            layerCount: environment.layers.length,
            soundboardCount: environment.soundboard.length
          });
          
          // Create a copy of the environment without effects
          const { effects, ...envWithoutEffects } = environment;
          
          // Add environment file
          environmentsFolder.file(`${envId}.json`, JSON.stringify(envWithoutEffects, null, 2));
          
          // Collect sound file IDs from this environment
          collectSoundFileIds(environment);
        }
      }

      // Add all referenced sound files
      const audioFolder = dataFolder.folder('audio')!;
      console.debug('Collected sound file IDs:', {
        totalIds: soundFileIds.size,
        ids: Array.from(soundFileIds)
      });
      
      const includedFiles = soundFiles.filter(file => soundFileIds.has(file.id));
      console.debug('Files to be included:', {
        totalFiles: includedFiles.length,
        files: includedFiles.map(f => ({ id: f.id, name: f.name }))
      });
      
      // Create a manifest file with metadata about the export
      const manifest = {
        exportDate: new Date().toISOString(),
        selection: {
          globalSettings: selection.globalSettings,
          globalSoundboard: selection.globalSoundboard,
          environments: selection.environments.map(envId => {
            const env = environments.find(e => e.id === envId);
            if (!env) {
              console.warn(`Environment ${envId} not found`);
              return { id: envId, name: 'Unknown Environment' };
            }
            return {
              id: envId,
              name: env.name
            };
          })
        },
        includedFiles: includedFiles.map(file => ({
          id: file.id,
          name: file.name,
          path: file.path
        }))
      };
      
      dataFolder.file('export-manifest.json', JSON.stringify(manifest, null, 2));

      // Fetch and add each sound file
      await Promise.all(includedFiles.map(async file => {
        try {
          // Get just the filename from the path
          const filename = file.path.split('/').pop() || '';
          
          console.debug('Fetching audio file:', {
            fileId: file.id,
            filename,
            path: file.path
          });
          
          // Use the correct API endpoint from fileService
          const response = await fetch(getFileUrl(file.id), {
            headers: {
              'Accept': 'audio/*'  // Request audio content
            }
          });
          
          if (!response.ok) {
            console.error('Failed to fetch audio file:', {
              fileId: file.id,
              status: response.status,
              statusText: response.statusText
            });
            throw new Error(`Failed to fetch audio file ${file.id}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          console.debug('Adding audio file to zip:', {
            fileId: file.id,
            filename,
            size: arrayBuffer.byteLength
          });
          
          audioFolder.file(filename, arrayBuffer, {
            binary: true  // Ensure binary data is handled correctly
          });
        } catch (error) {
          console.error(`Failed to add file ${file.id} to zip:`, error);
        }
      }));

      // Generate the zip file
      const blob = await zip.generateAsync({ 
        type: 'blob',
        compression: 'DEFLATE',  // Use compression
        compressionOptions: {
          level: 6  // Balanced between speed and compression
        }
      });
      
      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'orpheus-export.zip';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export:', error);
      // TODO: Show error notification
    }
  };

  const handleImport = async (selection: ImportSelection, zipData: JSZip) => {
    try {
      // First, handle the audio files
      const audioFolder = zipData.folder('data/audio');
      if (!audioFolder) throw new Error('Invalid import file: Missing audio folder');

      // Map of old file IDs to new file IDs (needed for environment references)
      const fileIdMap = new Map<string, string>();
      
      // Get manifest to know what files we're importing
      const manifestFile = zipData.file('data/export-manifest.json');
      if (!manifestFile) throw new Error('Invalid import file: Missing manifest');
      
      const manifest = JSON.parse(await manifestFile.async('string'));
      console.debug('Import manifest:', manifest);
      
      // Create import selection with environment names from manifest
      setImportSelection({
        globalSettings: manifest.selection.globalSettings,
        globalSoundboard: manifest.selection.globalSoundboard,
        environments: Object.fromEntries(
          manifest.selection.environments.map((env: { id: string; name: string }) => [
            env.id,
            {
              mode: EnvironmentImportMode.Update,
              name: env.name || env.id
            }
          ])
        )
      });

      // Upload all audio files and build the ID mapping
      for (const fileInfo of manifest.includedFiles) {
        try {
          const filename = fileInfo.path.split('/').pop()!;
          const audioFile = audioFolder.file(filename);
          if (!audioFile) {
            console.error(`Audio file not found in zip: ${filename}`);
            continue;
          }

          console.debug('Processing audio file:', {
            originalId: fileInfo.id,
            filename,
            originalPath: fileInfo.path,
            originalName: fileInfo.name
          });

          const blob = await audioFile.async('blob');
          const file = new File([blob], filename, {
            type: 'audio/*'
          });

          const uploadedFile = await uploadFile(file, fileInfo.name);
          console.debug('File uploaded successfully:', {
            originalId: fileInfo.id,
            newId: uploadedFile.id,
            filename: fileInfo.name
          });
          fileIdMap.set(fileInfo.id, uploadedFile.id);
        } catch (error) {
          console.error(`Failed to process file ${fileInfo.path}:`, error);
        }
      }

      // Handle global settings and soundboard
      const configFile = zipData.file('data/config.json');
      if (configFile) {
        const configContent = await configFile.async('string');
        console.debug('Loaded config.json:', configContent);
        const config = JSON.parse(configContent);
        console.debug('Parsed config:', config);
        
        // Handle global settings if selected
        if (selection.globalSettings) {
          console.debug('Importing global settings');
          // Update master volume
          onMasterVolumeChange(config.masterVolume);
          
          // Update effects
          onEffectsUpdate(config.effects);

          // Update local state to match imported settings
          setNormalizeVolume(config.effects.normalize.enabled);
          setFadeInDuration(config.effects.fades.fadeInDuration);
          setCrossfadeDuration(config.effects.fades.crossfadeDuration);
          setHighPassFreq(config.effects.filters.highPass.frequency);
          setLowPassFreq(config.effects.filters.lowPass.frequency);
          setDampenSpeechRange(config.effects.filters.dampenSpeechRange.amount);
          setCompressorLowThreshold(config.effects.compressor.lowThreshold);
          setCompressorHighThreshold(config.effects.compressor.highThreshold);
          setCompressorRatio(config.effects.compressor.ratio);
        }
        
        // Handle global soundboard if selected (separate from global settings)
        if (selection.globalSoundboard && config.soundboard) {
          console.debug('Importing global soundboard:', {
            selection,
            configSoundboard: config.soundboard,
            existingGlobalSoundboard: globalSoundboard
          });
          
          const newSoundboardIds = config.soundboard
            .map((oldId: string) => {
              const newId = fileIdMap.get(oldId);
              console.debug('Mapping soundboard ID:', {
                oldId,
                newId,
                found: !!newId
              });
              return newId;
            })
            .filter(Boolean);
          
          // Create a Set from existing soundboard to remove duplicates
          const mergedSoundboard = new Set([...globalSoundboard]);
          
          // Add new IDs to the set
          newSoundboardIds.forEach((id: string) => mergedSoundboard.add(id));
          
          console.debug('Merged global soundboard:', {
            originalIds: config.soundboard,
            newIds: newSoundboardIds,
            existingIds: globalSoundboard,
            mergedIds: Array.from(mergedSoundboard),
            mappedCount: newSoundboardIds.length,
            totalCount: mergedSoundboard.size,
            fileIdMap: Object.fromEntries(fileIdMap)
          });
          
          onGlobalSoundboardUpdate(Array.from(mergedSoundboard));
        } else {
          console.debug('Skipping global soundboard import:', {
            globalSoundboardSelected: selection.globalSoundboard,
            hasSoundboardInConfig: !!config.soundboard
          });
        }
      } else {
        console.debug('No config.json found in import');
      }

      // Handle environments
      const environmentsFolder = zipData.folder('data/environments');
      if (environmentsFolder) {
        for (const [envId, mode] of Object.entries(selection.environments)) {
          if (mode === EnvironmentImportMode.Skip) continue;

          const envFile = environmentsFolder.file(`${envId}.json`);
          if (!envFile) continue;

          const envData = JSON.parse(await envFile.async('string'));

          if (mode === EnvironmentImportMode.Insert) {
            // Generate new IDs for everything
            const newEnvId = generateId();
            const idMap = new Map<string, string>();

            // Create new environment with new IDs
            const newEnv: Environment = {
              ...envData,
              id: newEnvId,
              layers: envData.layers.map((layer: any) => ({
                ...layer,
                id: generateId(),
                sounds: layer.sounds.map((sound: any) => ({
                  ...sound,
                  id: generateId(),
                  fileId: fileIdMap.get(sound.fileId) || sound.fileId
                }))
              })),
              soundboard: envData.soundboard
                .map((oldId: string) => fileIdMap.get(oldId))
                .filter(Boolean)
            };

            // Add the new environment
            environments.push(newEnv);
          } else {
            // Update mode - keep IDs but update content
            const existingEnv = environments.find(e => e.id === envId);
            if (existingEnv) {
              // Update existing environment, mapping file IDs
              const updatedEnv: Environment = {
                ...envData,
                id: envId,
                layers: envData.layers.map((layer: any) => ({
                  ...layer,
                  sounds: layer.sounds.map((sound: any) => ({
                    ...sound,
                    fileId: fileIdMap.get(sound.fileId) || sound.fileId
                  }))
                })),
                soundboard: envData.soundboard
                  .map((oldId: string) => fileIdMap.get(oldId))
                  .filter(Boolean)
              };

              // Update the environment
              await onEnvironmentUpdate(updatedEnv);
            }
          }
        }
      }

      // Refresh the file list
      await refreshFiles();
    } catch (error) {
      console.error('Import failed:', error);
      throw error;
    }
  };

  const handleRevertToDefaults = () => {
    // Reset master volume
    onMasterVolumeChange(1);

    // Reset effects to default values
    setNormalizeVolume(true);
    setFadeInDuration(4000);
    setCrossfadeDuration(4000);
    setHighPassFreq(0);
    setLowPassFreq(20000);
    setDampenSpeechRange(0);
    setCompressorLowThreshold(-40);
    setCompressorHighThreshold(0);
    setCompressorRatio(1);

    // Update effects without closing the dialog
    const effects: Effects = {
      normalize: {
        enabled: true
      },
      fades: {
        fadeInDuration: 4000,
        crossfadeDuration: 4000
      },
      filters: {
        highPass: {
          frequency: 0
        },
        lowPass: {
          frequency: 20000
        },
        dampenSpeechRange: {
          amount: 0
        }
      },
      compressor: {
        lowThreshold: -40,
        highThreshold: 0,
        ratio: 1
      }
    };

    // Update workspace-level effects
    onEffectsUpdate(effects);
    setIsConfirmRevertOpen(false);
  };

  return (
    <>
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5">Configuration</Typography>
            <Box>
              <Button 
                onClick={() => setIsImportDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Import
              </Button>
              <Button 
                onClick={() => setIsExportDialogOpen(true)}
                sx={{ mr: 1 }}
              >
                Export
              </Button>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
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
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Effects</Typography>
                <Button 
                  onClick={() => setIsConfirmRevertOpen(true)}
                  size="small"
                  color="secondary"
                >
                  Revert to Defaults
                </Button>
              </Box>
              
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
                  <Tooltip title="This feature is supposed to only activate when somebody is speaking. But since Discord doesn't provide reliable voice activity detection, it's always active.">
                    <InfoIcon sx={{ ml: 1, fontSize: '1rem', verticalAlign: 'middle', color: 'text.secondary' }} />
                  </Tooltip>
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
      </Dialog>

      <ImportDialog
        open={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onImport={handleImport}
        environments={environments.map(env => ({ id: env.id, name: env.name }))}
      />

      <ExportDialog
        open={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        environments={environments}
        onExport={handleExport}
      />

      <FileManagerDialog
        open={isFileManagerOpen}
        onClose={handleCloseFileManager}
        soundFiles={localSoundFiles}
        onDeleteFile={handleDeleteFile}
      />

      {/* Revert to Defaults Confirmation Dialog */}
      <Dialog
        open={isConfirmRevertOpen}
        onClose={() => setIsConfirmRevertOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Revert to Default Settings</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to revert all effects settings to their default values? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsConfirmRevertOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRevertToDefaults}
            color="secondary"
            variant="contained"
          >
            Revert
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConfigOverlay; 