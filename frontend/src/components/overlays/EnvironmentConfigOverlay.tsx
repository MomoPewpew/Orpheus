import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Stack,
  TextField,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ImageIcon from '@mui/icons-material/Image';
import { Environment } from '../../types/audio';

interface EnvironmentConfigOverlayProps {
  environment: Environment;
  onEnvironmentUpdate: (environment: Environment) => void;
  onClose: () => void;
}

const EnvironmentConfigOverlay: React.FC<EnvironmentConfigOverlayProps> = ({
  environment,
  onEnvironmentUpdate,
  onClose,
}) => {
  const [name, setName] = useState(environment.name);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
  };

  const handleSave = () => {
    onEnvironmentUpdate({
      ...environment,
      name
    });
    onClose();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      onEnvironmentUpdate({
        ...environment,
        backgroundImage: reader.result as string
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBackground = () => {
    onEnvironmentUpdate({
      ...environment,
      backgroundImage: undefined
    });
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Box
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 24,
          p: 3,
          maxWidth: 'sm',
          width: '100%',
        }}
      >
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="h2">
              Environment Configuration
            </Typography>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Environment Name */}
          <TextField
            label="Environment Name"
            value={name}
            onChange={handleNameChange}
            fullWidth
          />

          {/* Background Image */}
          <Box>
            <Typography gutterBottom>Background Image</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<ImageIcon />}
                onClick={() => fileInputRef.current?.click()}
              >
                {environment.backgroundImage ? 'Change Image' : 'Upload Image'}
              </Button>
              {environment.backgroundImage && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleRemoveBackground}
                >
                  Remove Image
                </Button>
              )}
            </Box>
            {environment.backgroundImage && (
              <Box sx={{ mt: 2, position: 'relative', width: '100%', height: 200 }}>
                <Box
                  component="img"
                  src={environment.backgroundImage}
                  alt="Environment background"
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: 1,
                  }}
                />
              </Box>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              style={{ display: 'none' }}
            />
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>Save</Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};

export default EnvironmentConfigOverlay; 