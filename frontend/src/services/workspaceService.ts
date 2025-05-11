import { Environment, SoundFile, PlayState } from '../types/audio';

// Get the API URL from environment or use default
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_WORKSPACE = `${API_BASE}/api/workspace`;

export interface WorkspaceState {
  environments: Environment[];
  files: SoundFile[];
  masterVolume: number;
  soundboard: string[];
}

interface BackendState {
  environments: Environment[];
  files: SoundFile[];
  masterVolume: number;
  soundboard: string[];
  playState: PlayState;
}

/**
 * Saves the entire workspace state to the backend
 */
export async function saveWorkspace(state: WorkspaceState): Promise<void> {
  try {
    // Convert workspace state to match backend format
    const backendState: BackendState = {
      environments: state.environments.map((env: Environment) => ({
        ...env,
        soundboard: env.soundboard || [] // Ensure soundboard exists
      })) || [],
      files: state.files || [],
      masterVolume: state.masterVolume,
      soundboard: state.soundboard || [], // Global soundboard
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

    const data = JSON.parse(responseText) as BackendState;
    console.debug('Workspace data parsed:', data);
    
    // Ensure masterVolume is a valid number
    const masterVolume = typeof data.masterVolume === 'number' 
      ? data.masterVolume 
      : typeof data.masterVolume === 'string' 
        ? parseFloat(data.masterVolume) 
        : 1;

    console.debug('Processing loaded masterVolume:', {
      rawValue: data.masterVolume,
      processedValue: masterVolume,
      type: typeof masterVolume,
      dataKeys: Object.keys(data)
    });

    // Ensure environments have soundboard property
    const environments = (data.environments || []).map((env: Environment) => ({
      ...env,
      soundboard: env.soundboard || [] // Add soundboard if missing
    }));

    return {
      environments,
      files: data.files || [],
      masterVolume,
      soundboard: data.soundboard || [] // Global soundboard
    };
  } catch (error) {
    console.error('Error loading workspace:', error);
    throw error;
  }
} 