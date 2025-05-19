import React, { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import JSZip from 'jszip';

// Environment import modes
export enum EnvironmentImportMode {
  Skip = 'SKIP',
  Update = 'UPDATE',
  Insert = 'INSERT'
}

interface ImportManifest {
  exportDate: string;
  selection: {
    globalSettings: boolean;
    globalSoundboard: boolean;
    environments: Array<{
      id: string;
      name: string;
    }>;
  };
  includedFiles: Array<{
    id: string;
    name: string;
    path: string;
  }>;
}

export interface ImportSelection {
  globalSettings: boolean;
  globalSoundboard: boolean;
  environments: Record<string, EnvironmentImportMode>;  // envId -> import mode
}

export interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImport: (selection: ImportSelection, zipData: JSZip) => Promise<void>;
  environments: Array<{ id: string; name: string }>;
}

const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onClose,
  onImport,
  environments,
}) => {
  const [importZip, setImportZip] = useState<JSZip | null>(null);
  const [manifest, setManifest] = useState<ImportManifest | null>(null);
  const [selection, setSelection] = useState<ImportSelection>({
    globalSettings: false,
    globalSoundboard: false,
    environments: {}
  });
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog is opened
  useEffect(() => {
    if (open) {
      setImportZip(null);
      setManifest(null);
      setSelection({
        globalSettings: false,
        globalSoundboard: false,
        environments: {}
      });
      setError(null);
      
      // Also reset the file input if it exists
      const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    }
  }, [open]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setError(null);
      
      // Read the zip file
      const zip = await JSZip.loadAsync(file);
      
      // Try to read and parse the manifest
      const manifestFile = zip.file('data/export-manifest.json');
      if (!manifestFile) {
        throw new Error('Invalid export file: Missing manifest');
      }

      const manifestContent = await manifestFile.async('string');
      const manifest = JSON.parse(manifestContent) as ImportManifest;
      
      // Initialize selection state based on manifest
      const initialSelection: ImportSelection = {
        globalSettings: false,
        globalSoundboard: false,
        environments: Object.fromEntries(
          manifest.selection.environments.map(env => [env.id, EnvironmentImportMode.Insert])
        )
      };

      setImportZip(zip);
      setManifest(manifest);
      setSelection(initialSelection);
    } catch (error) {
      console.error('Failed to read import file:', error);
      setError(error instanceof Error ? error.message : 'Failed to read import file');
      setImportZip(null);
      setManifest(null);
    }
  };

  const handleEnvironmentModeChange = (envId: string, mode: EnvironmentImportMode) => {
    setSelection(prev => ({
      ...prev,
      environments: {
        ...prev.environments,
        [envId]: mode
      }
    }));
  };

  const handleImport = useCallback(async () => {
    if (!importZip || !manifest) return;
    
    try {
      await onImport(selection, importZip);
      onClose();
    } catch (error) {
      console.error('Import failed:', error);
      setError(error instanceof Error ? error.message : 'Import failed');
    }
  }, [importZip, manifest, selection, onImport, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Import Configuration</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <input
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            id="import-file-input"
          />
          <label htmlFor="import-file-input">
            <Button variant="contained" component="span">
              Choose File
            </Button>
          </label>
          {manifest && (
            <Typography variant="caption" sx={{ ml: 2 }}>
              Exported on: {new Date(manifest.exportDate).toLocaleString()}
            </Typography>
          )}
        </Box>

        {error && (
          <Typography color="error" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {manifest && (
          <FormGroup>
            {manifest.selection.globalSettings && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selection.globalSettings}
                    onChange={(e) => setSelection(prev => ({ ...prev, globalSettings: e.target.checked }))}
                  />
                }
                label="Global Settings"
              />
            )}

            {manifest.selection.globalSoundboard && (
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selection.globalSoundboard}
                    onChange={(e) => setSelection(prev => ({ ...prev, globalSoundboard: e.target.checked }))}
                  />
                }
                label="Global Soundboard"
              />
            )}

            {manifest.selection.environments.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Environments
                </Typography>
                {manifest.selection.environments.map((env, index) => (
                  <Box key={`env-${env.id}`} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={selection.environments[env.id]}
                        onChange={(e) => handleEnvironmentModeChange(env.id, e.target.value as EnvironmentImportMode)}
                      >
                        <MenuItem key={`${env.id}-skip`} value={EnvironmentImportMode.Skip}>Skip</MenuItem>
                        <MenuItem key={`${env.id}-update`} value={EnvironmentImportMode.Update}>Update</MenuItem>
                        <MenuItem key={`${env.id}-insert`} value={EnvironmentImportMode.Insert}>Insert as New</MenuItem>
                      </Select>
                    </FormControl>
                    <Typography sx={{ ml: 2 }}>
                      {env.name}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </FormGroup>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleImport}
          disabled={!importZip || !manifest}
          variant="contained"
        >
          Import
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ImportDialog; 