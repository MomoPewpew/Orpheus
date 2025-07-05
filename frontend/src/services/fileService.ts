import { SoundFile } from '../types/audio';
import { buildApiUrl, API_ENDPOINTS } from '../utils/api';

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

    const response = await fetch(buildApiUrl(API_ENDPOINTS.files), {
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
    const url = buildApiUrl(API_ENDPOINTS.files, searchQuery ? { search: searchQuery } : undefined);
    const response = await fetch(url);
    
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
  return buildApiUrl(`${API_ENDPOINTS.files}/${fileId}`);
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const response = await fetch(buildApiUrl(`${API_ENDPOINTS.files}/${fileId}`), {
    method: 'DELETE'
  });

  if (!response.ok) {
    throw new Error('Failed to delete file');
  }
}; 