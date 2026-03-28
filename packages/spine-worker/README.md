# Spine Worker

Desktop worker for the Spine orchestration platform. Executes jobs locally — video rendering, shell commands, and more.

## Installation

```bash
npm install -g @spine/worker
```

## Setup

```bash
# Interactive setup
spine-worker init

# Or with options
spine-worker init --url https://the-brain-2.vercel.app --token YOUR_TOKEN --name my-worker
```

## Usage

```bash
# Start the worker
spine-worker start

# With specific capabilities
spine-worker start --capabilities video.render,shell

# Check status
spine-worker status

# Detect system capabilities
spine-worker detect
```

## Configuration

Config file: `~/.spine/worker.json`

```json
{
  "spine_url": "https://the-brain-2.vercel.app",
  "auth_token": "your-token",
  "worker_id": "my-worker",
  "capabilities": {
    "video.render": true,
    "shell": true
  },
  "connection": {
    "protocol": "sse",
    "heartbeat_interval": 30
  }
}
```

## Capabilities

- `video.render` — Video rendering via Remotion
- `shell` — Shell command execution
- `ffmpeg` — Video processing
- `git` — Git operations
- `docker` — Container operations

## Requirements

- Node.js 18+
- Remotion (auto-installed per job)
- FFmpeg (optional, for post-processing)

## License

MIT
