import { Environment, SoundFile, Effects } from '../types/audio';
import { buildApiUrl, API_ENDPOINTS } from '../utils/api';

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

    // Convert to JSON string with no whitespace
    const requestBody = JSON.stringify(pythonState);
    
    const response = await fetch(buildApiUrl(API_ENDPOINTS.workspace), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      // Just throw the raw error text
      throw new Error(responseText);
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
    console.debug('Loading workspace state from:', buildApiUrl(API_ENDPOINTS.workspace));
    const response = await fetch(buildApiUrl(API_ENDPOINTS.workspace));
    
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