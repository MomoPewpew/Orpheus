import { Environment, SoundFile, PlayState } from '../types/audio';
import { generateId } from '../utils/ids';

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
  if (!state) {
    console.warn('Attempted to save undefined workspace state');
    return;
  }

  try {
    // Create a clean state object with only the required properties
    const cleanState = {
      environments: state.environments || [],
      files: state.files || [],
      masterVolume: typeof state.masterVolume === 'number' ? state.masterVolume : 1,
      soundboard: state.soundboard || [],
      playState: 'STOPPED' as const
    };

    // Convert to JSON string with no whitespace
    const requestBody = JSON.stringify(cleanState);
    
    // Log the exact JSON being sent
    console.debug('JSON being sent:', requestBody);
    console.debug('JSON length:', requestBody.length);
    console.debug('First 200 chars:', requestBody.substring(0, 200));
    console.debug('Last 200 chars:', requestBody.substring(Math.max(0, requestBody.length - 200)));
    
    // Verify JSON is valid before sending
    try {
      JSON.parse(requestBody);
    } catch (e) {
      console.error('Invalid JSON generated:', e);
      throw new Error('Generated invalid JSON');
    }

    const response = await fetch(API_WORKSPACE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const responseText = await response.text();
    console.debug('Raw server response:', responseText);
    
    if (!response.ok) {
      throw new Error(`Server error (${response.status}): ${responseText}`);
    }
  } catch (error) {
    console.error('Error saving workspace:', {
      error,
      message: error instanceof Error ? error.message : String(error)
    });
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