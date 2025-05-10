import { Environment, SoundFile } from './audio';

// For backward compatibility with existing code
export type AppConfig = {
    environments: Environment[];
    files: SoundFile[];
}; 