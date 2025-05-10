import { Environment, SoundFile, PlayState } from '../types/audio';

// Get the API URL from environment or use default
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_WORKSPACE = `${API_BASE}/api/workspace`;

export interface WorkspaceState {
  environments: Environment[];
  files: SoundFile[];
  masterVolume: number;
}

/**
 * Saves the entire workspace state to the backend
 */
export async function saveWorkspace(state: WorkspaceState): Promise<void> {
  try {
    // Convert workspace state to match backend format
    const backendState = {
      environments: state.environments,
      files: state.files,
      masterVolume: state.masterVolume,
      playState: PlayState.Stopped
    };

    console.debug('Saving workspace state to:', API_WORKSPACE);
    console.debug('Workspace state:', backendState);

    const response = await fetch(API_WORKSPACE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(backendState),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`Failed to save workspace: ${response.statusText}`);
    }

    const result = await response.json();
    console.debug('Save response:', result);
  } catch (error) {
    console.error('Error saving workspace:', error);
    throw error;
  }
}

/**
 * Loads the workspace state from the backend
 */
export async function loadWorkspace(): Promise<WorkspaceState> {
  try {
    console.debug('Loading workspace state from:', API_WORKSPACE);
    const response = await fetch(API_WORKSPACE);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Server response:', errorText);
      throw new Error(`Failed to load workspace: ${response.statusText}`);
    }

    const data = await response.json();
    console.debug('Loaded workspace state:', data);
    
    return {
      environments: data.environments,
      files: data.files,
      masterVolume: data.masterVolume
    };
  } catch (error) {
    console.error('Error loading workspace:', error);
    throw error;
  }
} 