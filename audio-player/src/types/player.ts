/**
 * Simple playback state for the audio player
 */
export enum PlayerState {
  Playing = 'PLAYING',
  Stopped = 'STOPPED',
  Connecting = 'CONNECTING',
  Error = 'ERROR'
}

/**
 * Minimal player configuration received from backend
 */
export interface PlayerConfig {
  streamUrl: string;      // URL of the audio stream
  volume: number;         // Initial volume (0-1)
  autoplay?: boolean;     // Whether to start playing immediately
}

/**
 * Current state of the player
 */
export interface PlayerStatus {
  state: PlayerState;
  volume: number;
  error?: string;        // Error message if state is Error
} 