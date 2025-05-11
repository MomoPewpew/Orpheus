import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Paper,
  DialogActions,
  Button,
  Dialog as ConfirmDialog,
  DialogTitle as ConfirmDialogTitle,
  DialogContent as ConfirmDialogContent,
  DialogContentText,
  DialogActions as ConfirmDialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { SoundFile } from '../../types/audio';

interface FileManagerDialogProps {
  open: boolean;
  onClose: () => void;
  soundFiles: SoundFile[];
  onDeleteFile: (fileId: string) => void;
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export const FileManagerDialog: React.FC<FileManagerDialogProps> = ({
  open,
  onClose,
  soundFiles,
  onDeleteFile,
}) => {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleDeleteClick = (fileId: string) => {
    setConfirmDelete(fileId);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      onDeleteFile(confirmDelete);
      setConfirmDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Manage Sound Files</DialogTitle>
        <DialogContent>
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Usage</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {soundFiles.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>{file.name}</TableCell>
                    <TableCell>{formatDuration(file.duration_ms)}</TableCell>
                    <TableCell>
                      {file.usageCount} {file.usageCount === 1 ? 'use' : 'uses'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        onClick={() => handleDeleteClick(file.id)}
                        disabled={file.usageCount > 0}
                        title={file.usageCount > 0 ? 'Cannot delete file that is in use' : 'Delete file'}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={handleCancelDelete}
      >
        <ConfirmDialogTitle>Confirm Delete</ConfirmDialogTitle>
        <ConfirmDialogContent>
          <DialogContentText>
            Are you sure you want to delete this sound file? This action cannot be undone.
          </DialogContentText>
        </ConfirmDialogContent>
        <ConfirmDialogActions>
          <Button onClick={handleCancelDelete}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" autoFocus>
            Delete
          </Button>
        </ConfirmDialogActions>
      </ConfirmDialog>
    </>
  );
};

export default FileManagerDialog; 