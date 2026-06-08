# Ovatu Zapier Bridge

A lightweight Node.js service that bridges Ovatu (salon management API) to Zapier via a polling-based webhook trigger layer. This enables salon owners to automate personalized WhatsApp messages (reminders, directions, follow-ups) through Zapier without manual effort.

## The Problem

Ovatu lacks native webhook support, making it difficult to integrate with automation platforms like Zapier for sending personalized WhatsApp messages to clients.

## The Solution

This service polls the Ovatu API for new/updated appointments and forwards them as HTTP POST requests to Zapier webhook URLs, effectively providing the "missing" webhook layer.

## How It Works

1. **Polling**: Service polls Ovatu API at configurable intervals for recent appointments
2. **Filtering**: Detects new appointments and updates using `updated_at_since` / `created_at_since` parameters
3. **Webhook Forwarding**: Sends appointment data to configured Zapier webhook URLs
4. **Zapier Automation**: Zapier triggers WhatsApp message flows (reminders, follow-ups, directions)

## Prerequisites

- Node.js 18+
- An Ovatu API token (generate from Ovatu Manager → Settings → API)
- A Zapier account with webhook trigger capability

## Setup

1. Clone this repository
2. Copy `.env.example` to `.env` and fill in your credentials:
   ```
   OVATU_API_TOKEN=your_api_token_here
   OVATU_BASE_URL=https://api.ovatu.com/v2
   ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-id
   POLL_INTERVAL_SECONDS=60
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the service:
   ```bash
   npm start
   ```

## API Reference (Ovatu)

### Authentication
- **Method**: Bearer Token
- **Header**: `Authorization: Bearer <API_TOKEN>`
- **Base URL**: `https://api.ovatu.com/v2`

### Appointments Endpoint
```
GET /appointments
```

### Supported Query Parameters for Polling
| Parameter | Description |
|-----------|-------------|
| `updated_at_since` | ISO 8601 date - returns appointments updated after this timestamp |
| `created_at_since` | ISO 8601 date - returns appointments created after this timestamp |
| `per_page` | Results per page (default varies) |
| `page` | Page number for pagination |

## Project Structure

```
ovatu-zapier-bridge/
├── index.js          # Main polling server
├── ovatu-client.js   # Ovatu API client
├── webhook-sender.js # Zapier webhook dispatcher
├── .env.example      # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

## Development

### Testing the API connection
```bash
node test.js
```

### Environment Variables
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OVATU_API_TOKEN` | Yes | - | Your Ovatu API token |
| `OVATU_BASE_URL` | No | `https://api.ovatu.com/v2` | Ovatu API base URL |
| `ZAPIER_WEBHOOK_URL` | Yes | - | Zapier webhook to forward appointments |
| `POLL_INTERVAL_SECONDS` | No | 60 | How often to poll (seconds) |

## License

MIT
