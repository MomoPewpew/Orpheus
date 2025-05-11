import { SoundFile } from '../types/audio';

const API_BASE = 'http://localhost:5000';
const API_FILES = `${API_BASE}/api/files`;

/**
 * Upload a new audio file
 */
export const uploadFile = async (file: File, name?: string): Promise<SoundFile> => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    if (name) {
      formData.append('name', name);
    }

    const response = await fetch(API_FILES, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload file');
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * List all available audio files
 */
export const listFiles = async (searchQuery?: string): Promise<SoundFile[]> => {
  try {
    const url = new URL(API_FILES);
    if (searchQuery) {
      url.searchParams.append('search', searchQuery);
    }
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error('Failed to fetch files');
    }
    return await response.json();
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

/**
 * Get the URL for an audio file
 */
export const getFileUrl = (fileId: string): string => {
  return `${API_FILES}/${fileId}`;
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const response = await fetch(`${API_FILES}/${fileId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
}; 