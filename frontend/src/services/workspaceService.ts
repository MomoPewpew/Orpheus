import { Environment, SoundFile, PlayState, Effects } from '../types/audio';
import { generateId } from '../utils/ids';

// Get the API URL from environment or use default
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const API_WORKSPACE = `${API_BASE}/workspace`;

// Helper function to convert JS booleans to Python-style booleans in JSON
function convertToPythonBooleans(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'boolean') {
    return obj ? 'True' : 'False';
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertToPythonBooleans);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = convertToPythonBooleans(obj[key]);
    }
    return result;
  }
  
  return obj;
}

export interface WorkspaceState {
  environments: Environment[];
  files: SoundFile[];
  masterVolume: number;
  soundboard: string[];
  effects: Effects;
}

interface BackendState {
  environments: Environment[];
  files: SoundFile[];
  masterVolume: number;
  soundboard: string[];
  effects: Effects;
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
    // Log the incoming state
    console.debug('Saving workspace state:', {
      hasEffects: !!state.effects,
      effectsKeys: state.effects ? Object.keys(state.effects) : [],
      fullEffects: state.effects,
      stateKeys: Object.keys(state)
    });

    // Create a clean state object with only the required properties
    const cleanState = {
      environments: state.environments || [],
      files: state.files || [],
      masterVolume: typeof state.masterVolume === 'number' ? state.masterVolume : 1,
      soundboard: state.soundboard || [],
      effects: state.effects || {
        normalize: { enabled: true },
        fades: { fadeInDuration: 4000, crossfadeDuration: 4000 },
        filters: {
          highPass: { frequency: 0 },
          lowPass: { frequency: 20000 },
          dampenSpeechRange: { amount: 0 }
        },
        compressor: {
          lowThreshold: -40,
          highThreshold: 0,
          ratio: 1
        }
      }
    };

    // Convert boolean values to Python format
    const pythonState = convertToPythonBooleans(cleanState);

    // Log the clean state before serialization
    console.debug('Clean state before JSON:', {
      hasEffects: !!pythonState.effects,
      effectsKeys: pythonState.effects ? Object.keys(pythonState.effects) : [],
      fullEffects: pythonState.effects,
      cleanStateKeys: Object.keys(pythonState)
    });

    // Convert to JSON string with no whitespace
    const requestBody = JSON.stringify(pythonState);
    
    // Log the exact JSON being sent
    console.debug('JSON being sent:', requestBody);
    console.debug('JSON length:', requestBody.length);
    console.debug('First 200 chars:', requestBody.substring(0, 200));
    console.debug('Last 200 chars:', requestBody.substring(Math.max(0, requestBody.length - 200)));
    
    // Verify JSON is valid and contains effects
    try {
      const parsed = JSON.parse(requestBody);
      console.debug('Parsed JSON verification:', {
        hasEffects: !!parsed.effects,
        effectsKeys: parsed.effects ? Object.keys(parsed.effects) : [],
        parsedKeys: Object.keys(parsed),
        fullEffects: parsed.effects
      });
    } catch (e) {
      console.error('Invalid JSON generated:', e);
      throw new Error('Generated invalid JSON');
    }

    // Log the actual request being sent
    console.debug('Sending request with:', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody
    });

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
    console.debug('Workspace data parsed:', {
      hasEffects: !!data.effects,
      effectsKeys: data.effects ? Object.keys(data.effects) : [],
      fullEffects: data.effects,
      allKeys: Object.keys(data)
    });
    
    // Ensure masterVolume is a valid number
    const masterVolume = typeof data.masterVolume === 'number' 
      ? data.masterVolume 
      : typeof data.masterVolume === 'string' 
        ? parseFloat(data.masterVolume) 
        : 1;

    // Ensure environments have soundboard property and playState
    const environments = (data.environments || []).map((env: Environment) => ({
      ...env,
      soundboard: env.soundboard || [], // Add soundboard if missing
      activePresetId: env.activePresetId === null ? undefined : env.activePresetId // Ensure null is converted to undefined
    }));

    // Default effects if not present
    const effects = data.effects || {
      normalize: { enabled: true },
      fades: { fadeInDuration: 4000, crossfadeDuration: 4000 },
      filters: {
        highPass: { frequency: 0 },
        lowPass: { frequency: 20000 },
        dampenSpeechRange: { amount: 0 }
      },
      compressor: {
        lowThreshold: -40,
        highThreshold: 0,
        ratio: 1
      }
    };

    console.debug('Final effects being returned:', {
      hasEffects: !!effects,
      effectsKeys: Object.keys(effects),
      fullEffects: effects
    });

    return {
      environments,
      files: data.files || [],
      masterVolume,
      soundboard: data.soundboard || [], // Global soundboard
      effects
    };
  } catch (error) {
    console.error('Error loading workspace:', error);
    throw error;
  }
} 