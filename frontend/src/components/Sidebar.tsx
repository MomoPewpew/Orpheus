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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Environment, SoundFile } from '../types/audio';
import { 
  Droppable, 
  Draggable, 
  DroppableProvided, 
  DroppableStateSnapshot,
  DraggableProvided,
  DraggableStateSnapshot 
} from '@hello-pangea/dnd';
import ConfigOverlay from './overlays/ConfigOverlay';

interface SidebarProps {
  environments: Environment[];
  activeEnvironment?: Environment | null;
  onNewEnvironment: () => void;
  onToggleConfig: () => void;
  onToggleSoundboard: () => void;
  onEnvironmentSelect: (environment: Environment) => void;
  masterVolume: number;
  onMasterVolumeChange: (volume: number) => void;
  soundFiles: SoundFile[];
  onSoundFilesChange: (files: SoundFile[]) => void;
}

const DRAWER_WIDTH = 280;

export const Sidebar: React.FC<SidebarProps> = ({
  environments,
  activeEnvironment,
  onNewEnvironment,
  onToggleConfig,
  onToggleSoundboard,
  onEnvironmentSelect,
  masterVolume,
  onMasterVolumeChange,
  soundFiles,
  onSoundFilesChange,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const filteredEnvironments = environments.filter(env =>
    env.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggleConfig = () => {
    setShowConfig(!showConfig);
  };

  return (
    <>
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
                onClick={handleToggleConfig}
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

        <Box 
          sx={{ 
            flexGrow: 1, 
            overflow: 'auto',
            px: 2,
            pb: 2,
            position: 'relative',
            height: '100%'
          }}
        >
          <Droppable droppableId="environments" type="environment">
            {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
              <List
                disablePadding
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{ 
                  minHeight: 50,
                  backgroundColor: snapshot.isDraggingOver ? 'action.hover' : 'transparent',
                  transition: 'background-color 0.2s ease'
                }}
              >
                {filteredEnvironments.map((env, index) => (
                  <Draggable 
                    key={env.id} 
                    draggableId={env.id} 
                    index={index}
                  >
                    {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                      <ListItem
                        component="div"
                        disablePadding
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        sx={{
                          backgroundColor: snapshot.isDragging ? 'action.hover' : 'transparent',
                          transition: 'background-color 0.2s ease'
                        }}
                      >
                        <ListItemButton
                          selected={env.id === activeEnvironment?.id}
                          onClick={() => onEnvironmentSelect(env)}
                          sx={{ pr: 1 }}
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
                          <Box {...provided.dragHandleProps}>
                            <DragIndicatorIcon 
                              sx={{ 
                                color: 'text.secondary',
                                opacity: 0.5,
                                cursor: 'grab',
                              }} 
                            />
                          </Box>
                        </ListItemButton>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </Box>
      </Drawer>

      {showConfig && (
        <ConfigOverlay
          masterVolume={masterVolume}
          onMasterVolumeChange={onMasterVolumeChange}
          onClose={handleToggleConfig}
          soundFiles={soundFiles}
          onSoundFilesChange={onSoundFilesChange}
        />
      )}
    </>
  );
};

export default Sidebar; 