import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
} from '@mui/material';
import { Environment } from '../../types/audio';

export interface ExportSelection {
  globalSettings: boolean;
  globalSoundboard: boolean;
  environments: string[];
}

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  environments: Environment[];
  onExport: (selection: ExportSelection) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({
  open,
  onClose,
  environments,
  onExport,
}: ExportDialogProps) => {
  const [selection, setSelection] = useState<ExportSelection>({
    globalSettings: true,
    globalSoundboard: true,
    environments: environments.map((env: Environment) => env.id),
  });

  const handleToggleEnvironment = (envId: string) => {
    setSelection((prev: ExportSelection) => ({
      ...prev,
      environments: prev.environments.includes(envId)
        ? prev.environments.filter((id: string) => id !== envId)
        : [...prev.environments, envId],
    }));
  };

  const handleToggleGlobalSettings = () => {
    setSelection((prev: ExportSelection) => ({
      ...prev,
      globalSettings: !prev.globalSettings,
    }));
  };

  const handleToggleGlobalSoundboard = () => {
    setSelection((prev: ExportSelection) => ({
      ...prev,
      globalSoundboard: !prev.globalSoundboard,
    }));
  };

  const handleExport = () => {
    onExport(selection);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Configuration</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Global Settings
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={selection.globalSettings}
                  onChange={handleToggleGlobalSettings}
                />
              }
              label="Export global settings (effects, master volume)"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={selection.globalSoundboard}
                  onChange={handleToggleGlobalSoundboard}
                />
              }
              label="Export global soundboard"
            />
          </FormGroup>
        </Box>

        <Box>
          <Typography variant="subtitle1" gutterBottom>
            Environments
          </Typography>
          <FormGroup>
            {environments.map(env => (
              <FormControlLabel
                key={env.id}
                control={
                  <Checkbox
                    checked={selection.environments.includes(env.id)}
                    onChange={() => handleToggleEnvironment(env.id)}
                  />
                }
                label={env.name || `Environment ${env.id}`}
              />
            ))}
          </FormGroup>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleExport}
          variant="contained"
          disabled={!selection.environments.length && !selection.globalSettings && !selection.globalSoundboard}
        >
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExportDialog; 