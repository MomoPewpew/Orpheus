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
  DragIndicator,
} from '@mui/icons-material';
import { Environment, SoundFile } from '../types/audio';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';

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
  onEnvironmentsReorder: (environments: Environment[]) => void;
}

const DRAWER_WIDTH = 280;

export const Sidebar: React.FC<SidebarProps> = ({
  environments,
  activeEnvironment,
  onEnvironmentSelect,
  onNewEnvironment,
  onToggleConfig,
  onToggleSoundboard,
  onEnvironmentsReorder,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEnvironments = environments.filter((env: Environment) =>
    env.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination } = result;
    const items = Array.from(environments);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    onEnvironmentsReorder(items);
  };

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
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="environments" type="environment">
            {(provided) => (
              <List 
                ref={provided.innerRef}
                {...provided.droppableProps}
                sx={{ flex: 1, overflow: 'auto' }}
              >
                {filteredEnvironments.map((env, index) => (
                  <Draggable key={env.id} draggableId={env.id} index={index}>
                    {(provided, snapshot) => (
                      <ListItem 
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        disablePadding
                      >
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
                          <Box 
                            {...provided.dragHandleProps}
                            sx={{ 
                              display: 'flex',
                              alignItems: 'center',
                              mr: 1,
                              cursor: 'grab',
                              '&:active': { cursor: 'grabbing' },
                              opacity: 0.5,
                            }}
                          >
                            <DragIndicator fontSize="small" />
                          </Box>
                          <ListItemText 
                            primary={env.name} 
                            sx={{ 
                              position: 'relative',
                              zIndex: 1,
                              opacity: snapshot.isDragging ? 0.5 : 1,
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </List>
            )}
          </Droppable>
        </DragDropContext>

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