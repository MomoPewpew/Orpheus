# Orpheus

Orpheus is a Discord bot designed to play ambient sounds and layered musical tracks for tabletop roleplay. The bot offers a web-based control panel for directors to manage audio playback and configurations.

## Components

1. **Discord Bot** (`/discord-bot`)
   - Handles joining voice channels and streaming audio
   - Written in Python using discord.py

2. **Web Panel** (`/frontend`)
   - Main control interface for directors
   - Built with TypeScript and React

3. **Backend Server** (`/backend`)
   - Handles audio processing and streaming
   - Built with Python and FastAPI

4. **Audio Player** (`/audio-player`)
   - Minimal web interface for audio playback
   - Built with TypeScript and React

## Development Setup

### Prerequisites

- Docker and Docker Compose
- Node.js (v18 or higher)
- Python (v3.10 or higher)
- Git

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/Orpheus.git
   cd Orpheus
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. Start the development environment:
   ```bash
   docker-compose up -d
   ```

## Project Structure

```
Orpheus/
├── discord-bot/     # Discord bot component
├── frontend/        # Main web panel
├── backend/         # Backend server
└── audio-player/    # Minimal audio player
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 