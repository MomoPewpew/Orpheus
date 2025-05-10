import { AppConfig } from '../types/config';
import { SoundFile } from '../types/audio';

const API_BASE = '/api';

export async function saveConfig(config: AppConfig): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(`Failed to save config: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error saving config:', error);
    throw error;
  }
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const response = await fetch(`${API_BASE}/config`);
    
    if (!response.ok) {
      throw new Error(`Failed to load config: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error loading config:', error);
    throw error;
  }
}

// Audio file operations will be handled by the Python backend
export async function uploadAudioFile(file: File): Promise<SoundFile> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE}/audio/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
} 