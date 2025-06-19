import React, { useState } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Button,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Speaker as SpeakerIcon,
} from '@mui/icons-material';
import { Environment, SoundFile } from '../types/audio';

interface SidebarProps {
  environments: Environment[];
  activeEnvironment: Environment | null;
  onEnvironmentSelect: (environment: Environment) => void;
  onNewEnvironment: () => void;
  onToggleConfig: () => void;
  onToggleSoundboard: () => void;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  soundFiles: SoundFile[];
  onSoundFilesChange: (files: SoundFile[]) => void;
}

const DRAWER_WIDTH = 280;

export const Sidebar: React.FC<SidebarProps> = ({
  environments,
  activeEnvironment,
  onEnvironmentSelect,
  onNewEnvironment,
  onToggleConfig,
  onToggleSoundboard,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEnvironments = environments.filter((env: Environment) =>
    env.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          bgcolor: '#f5f5f5',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h1">
            Orpheus
          </Typography>
          <Box>
            <Tooltip title="Global Settings">
              <IconButton onClick={onToggleConfig} size="small">
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Soundboard">
              <IconButton onClick={onToggleSoundboard} size="small">
                <SpeakerIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Search */}
        <TextField
          size="small"
          placeholder="Search environments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Environment List */}
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {filteredEnvironments.map((env) => (
            <ListItem key={env.id} disablePadding>
              <ListItemButton
                selected={activeEnvironment?.id === env.id}
                onClick={() => onEnvironmentSelect(env)}
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  '&::before': env.backgroundImage ? {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `url(${env.backgroundImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.15,
                    zIndex: 0,
                  } : undefined,
                }}
              >
                <ListItemText 
                  primary={env.name} 
                  sx={{ 
                    position: 'relative',
                    zIndex: 1,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        {/* Add Environment Button */}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNewEnvironment}
          sx={{ 
            mt: 2,
            bgcolor: '#fff',
            color: 'primary.main',
            '&:hover': {
              bgcolor: '#f0f0f0',
            }
          }}
        >
          Add Environment
        </Button>
      </Box>
    </Drawer>
  );
};

export default Sidebar; 