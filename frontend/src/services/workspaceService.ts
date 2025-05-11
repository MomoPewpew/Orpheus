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
    // Ensure masterVolume is a valid number and convert to a string for consistency
    const masterVolume = Number(state.masterVolume).toString();

    // Convert workspace state to match backend format
    const backendState = {
      environments: state.environments || [],
      files: state.files || [],
      masterVolume: parseFloat(masterVolume),
      playState: PlayState.Stopped
    };

    const requestBody = JSON.stringify(backendState);

    const response = await fetch(API_WORKSPACE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Server response:', responseText);
      throw new Error(`Failed to save workspace: ${response.statusText}`);
    }

    const result = JSON.parse(responseText);
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
    
    const responseText = await response.text();
    console.debug('Raw response from server:', responseText);
    
    if (!response.ok) {
      console.error('Server response:', responseText);
      throw new Error(`Failed to load workspace: ${response.statusText}`);
    }

    const data = JSON.parse(responseText);
    console.debug('Workspace data parsed:', data);
    
    // Ensure masterVolume is a valid number
    const masterVolume = parseFloat(data.masterVolume) || 1;
    console.debug('Processing loaded masterVolume:', {
      rawValue: data.masterVolume,
      processedValue: masterVolume,
      type: typeof masterVolume,
      dataKeys: Object.keys(data)
    });

    return {
      environments: data.environments || [],
      files: data.files || [],
      masterVolume
    };
  } catch (error) {
    console.error('Error loading workspace:', error);
    throw error;
  }
} 