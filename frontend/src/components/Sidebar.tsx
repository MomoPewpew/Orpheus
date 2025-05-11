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
                          transition: 'background-color 0.2s ease',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Background Image */}
                        {env.backgroundImage && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              zIndex: 0,
                              opacity: 0.15,
                              overflow: 'hidden',
                              '&::before': {
                                content: '""',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backdropFilter: 'blur(1px)',
                              }
                            }}
                          >
                            <Box
                              component="img"
                              src={env.backgroundImage}
                              alt=""
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                transform: 'scale(1.1)', // Slight zoom for a more dynamic look
                                transition: 'transform 0.3s ease',
                                '.MuiListItemButton-root:hover &': {
                                  transform: 'scale(1.15)', // Zoom in slightly on hover
                                }
                              }}
                            />
                          </Box>
                        )}

                        <ListItemButton
                          selected={env.id === activeEnvironment?.id}
                          onClick={() => onEnvironmentSelect(env)}
                          sx={{ 
                            pr: 1,
                            position: 'relative',
                            zIndex: 1,
                            transition: 'all 0.3s ease',
                            '&:hover': {
                              backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            }
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