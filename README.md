# GeiminiRevolver

An OpenAI v1 compatible API endpoint that rotates Gemini API keys to avoid rate limiting. Built with TypeScript and Node.js.

## Features

- 🔐 **Password-based API key authentication** - Clients must provide a configured password as their API key
- 🔄 **Automatic API key rotation** - Rotates across multiple Gemini API keys to avoid rate limiting
- 📝 **Request/response logging** - Logs all API requests and responses to JSON files
- 🎯 **OpenAI v1 compatible** - Drop-in replacement for OpenAI API endpoints
- ⚡ **Rate limit handling** - Automatically handles rate limiting and rotates to available keys
- 🐳 **Docker support** - Containerized deployment with Docker and Docker Compose
- 🌐 **Cloudflare Tunnel integration** - Securely expose your API via Cloudflare tunnel

## Setup

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Gemini API keys (get free keys from [Google AI Studio](https://makersuite.google.com/app/apikey))

### Installation

1. Clone the repository and navigate to the project directory

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
API_PASSWORD=your_secure_password_here
GEMINI_API_KEYS=key1,key2,key3
PORT=3000
LOG_DIR=./logs
```

### Running the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm run build
npm start
```

## Docker Deployment

### Prerequisites

- Docker and Docker Compose installed
- Cloudflare account (for tunnel setup)

### Cloudflare Tunnel Setup

1. **Create a Cloudflare Tunnel:**
   - Go to [Cloudflare Zero Trust Dashboard](https://dash.cloudflare.com/)
   - Navigate to Access > Tunnels
   - Create a new tunnel and copy the tunnel token

2. **Configure the tunnel:**
   - Add your domain to the tunnel ingress rules
   - Set the service to point to `http://geimini-revolver:3000`

### Docker Deployment

1. **Configure environment variables:**
```bash
cp .env.example .env
```

2. **Edit `.env` with your configuration:**
```env
API_PASSWORD=your_secure_password_here
GEMINI_API_KEYS=key1,key2,key3
CLOUDFLARE_TUNNEL_TOKEN=your_cloudflare_tunnel_token_here
CLOUDFLARE_DOMAIN=your-domain.com
```

3. **Build and start with Docker Compose:**
```bash
docker-compose up -d
```

4. **Check status:**
```bash
docker-compose ps
docker-compose logs -f
```

5. **Stop the services:**
```bash
docker-compose down
```

### Docker Commands

- **Build only:** `docker-compose build`
- **Rebuild without cache:** `docker-compose build --no-cache`
- **View logs:** `docker-compose logs -f geimini-revolver`
- **Restart services:** `docker-compose restart`
- **Stop and remove containers:** `docker-compose down -v`

### Accessing the API

With Cloudflare tunnel running, your API will be accessible at:
- `https://your-domain.com/v1/chat/completions`
- `https://your-domain.com/v1/models`
- `https://your-domain.com/health`

Use the same authentication method with your configured `API_PASSWORD`.

## API Usage

### Authentication

Use your configured `API_PASSWORD` as the Bearer token:

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Authorization: Bearer your_secure_password_here" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-flash-lite-latest",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'
```

### Endpoints

#### `POST /v1/chat/completions`
Create chat completions (OpenAI v1 compatible)

**Request body:**
```json
{
  "model": "gemini-flash-lite-latest",
  "messages": [
    {"role": "user", "content": "Your message here"}
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}
```

**Response:**
```json
{
  "id": "chatcmpl-req_1234567890_abc123",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gemini-flash-lite-latest",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Response from Gemini"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

#### `GET /v1/models`
List available models

#### `GET /health`
Health check endpoint with key rotation statistics

## Logging

All requests and responses are logged to JSON files in the configured `LOG_DIR`. Log files are named by date: `api-logs-YYYY-MM-DD.json`

Each log entry contains:
- timestamp
- request ID
- type (request/response/error)
- full request/response data

## Key Rotation Strategy

The system uses a round-robin rotation strategy with rate limit awareness:

1. Keys are rotated in sequence
2. Rate-limited keys are temporarily skipped
3. If all keys are rate-limited, the least recently used key is selected
4. Request counts and last-used timestamps are tracked for monitoring

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `API_PASSWORD` | Password clients must use as API key | (required) |
| `GEMINI_API_KEYS` | Comma-separated list of Gemini API keys | (required) |
| `PORT` | Server port | 3000 |
| `LOG_DIR` | Directory for log files | ./logs |
| `CLOUDFLARE_TUNNEL_TOKEN` | Cloudflare tunnel token (Docker only) | (required for Docker) |
| `CLOUDFLARE_DOMAIN` | Domain for Cloudflare tunnel (Docker only) | (required for Docker) |

## Project Structure

```
GeiminiRevolver/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── config.ts         # Configuration management
│   ├── auth.ts           # Authentication middleware
│   ├── keyRotation.ts    # API key rotation logic
│   ├── logger.ts         # Request/response logging
│   ├── routes.ts         # API route handlers
│   └── openaiTypes.ts    # OpenAI type definitions
├── logs/                 # Log files (created at runtime)
├── dist/                 # Compiled JavaScript (created at build)
├── .env                  # Environment variables (not in git)
├── .env.example          # Environment variables template
├── .dockerignore         # Docker ignore rules
├── Dockerfile            # Docker image configuration
├── docker-compose.yml    # Docker Compose configuration
├── cloudflared-config.yml # Cloudflare tunnel configuration
├── package.json          # Project dependencies
├── tsconfig.json         # TypeScript configuration
├── test-api.sh          # API testing script
├── example-client.js    # Example client implementation
└── README.md            # This file
```

## Security Notes

- Never commit `.env` file to version control
- Use strong passwords for `API_PASSWORD`
- Rotate your Gemini API keys regularly
- Keep the server behind proper authentication in production
- Log files may contain sensitive data - secure them appropriately
- When using Cloudflare Tunnel, enable additional authentication in Cloudflare Access

## Troubleshooting

### Docker Issues

**Container won't start:**
```bash
docker-compose logs geimini-revolver
```

**Port conflicts:**
- Change the port mapping in `docker-compose.yml` or stop other services using port 3000

**Permission issues with logs:**
- Ensure the `./logs` directory has proper write permissions

**Cloudflare tunnel connection issues:**
- Verify your `CLOUDFLARE_TUNNEL_TOKEN` is correct
- Check that the tunnel is active in your Cloudflare dashboard
- Ensure the domain is properly configured in Cloudflare DNS

### Application Issues

**Rate limiting still occurring:**
- Add more Gemini API keys to your configuration
- Check the health endpoint for key usage statistics
- Consider implementing additional rate limiting at the application level

**Authentication failures:**
- Verify the `API_PASSWORD` matches between client and server
- Check that the Authorization header format is correct: `Bearer <password>`

**TypeScript build errors:**
- Ensure all dependencies are installed: `npm install`
- Clear build cache: `rm -rf dist/ && npm run build`

## License

MIT
