import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Drawer,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SettingsIcon from '@mui/icons-material/Settings';
import SpeakerIcon from '@mui/icons-material/Speaker';
import { Environment } from '../types/audio';

interface SidebarProps {
  environments: Environment[];
  activeEnvironment?: Environment | null;
  onNewEnvironment: () => void;
  onToggleConfig: () => void;
  onToggleSoundboard: () => void;
  onEnvironmentSelect: (environment: Environment) => void;
}

const DRAWER_WIDTH = 280;

export const Sidebar: React.FC<SidebarProps> = ({
  environments,
  activeEnvironment,
  onNewEnvironment,
  onToggleConfig,
  onToggleSoundboard,
  onEnvironmentSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEnvironments = environments.filter(env =>
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
      <Box sx={{ p: 2, flexShrink: 0 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 2, justifyContent: 'space-between' }}>
          <Tooltip title="Add Environment">
            <IconButton
              color="primary"
              onClick={onNewEnvironment}
              size="small"
              sx={{
                bgcolor: '#fff',
                '&:hover': {
                  bgcolor: '#f0f0f0',
                },
              }}
            >
              <AddIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Configuration">
            <IconButton
              onClick={onToggleConfig}
              size="small"
              sx={{
                bgcolor: '#fff',
                '&:hover': {
                  bgcolor: '#f0f0f0',
                },
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Soundboard">
            <IconButton
              onClick={onToggleSoundboard}
              size="small"
              sx={{
                bgcolor: '#fff',
                '&:hover': {
                  bgcolor: '#f0f0f0',
                },
              }}
            >
              <SpeakerIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <TextField
          fullWidth
          size="small"
          placeholder="Search environments..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              bgcolor: '#fff',
            },
          }}
        />
      </Box>

      <Box sx={{ 
        flexGrow: 1, 
        overflow: 'auto',
        px: 2,
        pb: 2,
      }}>
        <List sx={{ width: '100%' }}>
          {filteredEnvironments.map((env) => (
            <ListItem key={env.id} disablePadding>
              <ListItemButton
                selected={env.id === activeEnvironment?.id}
                onClick={() => onEnvironmentSelect(env)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: '#e3f2fd',
                    '&:hover': {
                      bgcolor: '#e3f2fd',
                    },
                  },
                }}
              >
                <ListItemText 
                  primary={env.name}
                  secondary={`${env.layers.length} layers`}
                  primaryTypographyProps={{
                    fontSize: '0.9rem',
                    noWrap: true,
                  }}
                  secondaryTypographyProps={{
                    fontSize: '0.8rem',
                    noWrap: true,
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>
    </Drawer>
  );
};

export default Sidebar; 