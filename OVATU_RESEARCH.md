# Ovatu API Research

## Authentication
Ovatu API v2 uses **Bearer Token** authentication.
- Base URL: `https://api.ovatu.com/v2`
- Header: `Authorization: Bearer <YOUR_API_TOKEN>`
- Tokens generated from Ovatu Manager → Settings → API

## API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v2/appointments` | GET | List appointments (with filtering) |

## Polling Parameters
Since Ovatu lacks webhooks, polling uses date-based filtering:

| Parameter | Type | Description |
|-----------|------|-------------|
| `updated_at_since` | ISO 8601 | Returns appointments updated after timestamp |
| `created_at_since` | ISO 8601 | Returns appointments created after timestamp |
| `per_page` | Integer | Results per page |
| `page` | Integer | Page number for pagination |

## Architecture for Polling
1. Track `lastPollTimestamp` in memory
2. On each poll cycle, call `GET /appointments?updated_at_since={lastPollTimestamp}`
3. Forward returned appointments to Zapier webhook
4. Update `lastPollTimestamp` to current time

## Business Context
- **Owner**: Little Waxing Company / small salon chains using Ovatu
- **Need**: Automated WhatsApp reminders, follow-ups, and directions to clients
- **Constraint**: Ovatu has no webhook support for real-time event notifications
- **Solution**: Poll every 30-120 seconds and bridge to Zapier, which handles WhatsApp via Twilio/WhatsApp Business API

## Bridge Project
The bridge service lives at:
```
/home/team/shared/ovatu-zapier-bridge/
```

Components:
- `ovatu-client.js` - Ovatu API client with polling methods
- `webhook-sender.js` - Forwards appointments to Zapier
- `index.js` - Main polling loop server
- `test.js` - Connection test utility

## Zapier Integration Flow
```
Ovatu API → Bridge (polling) → Zapier Webhook → WhatsApp Message
         ↑ polling           ↑ POST JSON       ↑ Twilio/WhatsApp Business
```

## Troubleshooting
- `help.ovatu.com` may return 500 errors (platform issue, not API issue)
- API endpoint `api.ovatu.com` is active and responsive
- Root `/v2/` returns 404, but `/v2/appointments` works with valid token
- Ensure API token has proper permissions for reading appointments