import { Environment } from '../types/audio';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const API_ENVIRONMENT = `${API_BASE}/api/environment`;

/**
 * Update the state of an environment and trigger audio playback
 */
export async function updateEnvironmentState(
  guildId: string,
  environment: Environment
): Promise<void> {
  try {
    const response = await fetch(`${API_ENVIRONMENT}/state`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guild_id: guildId,
        environment: environment,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update environment state: ${errorText}`);
    }
  } catch (error) {
    console.error('Error updating environment state:', error);
    throw error;
  }
} 