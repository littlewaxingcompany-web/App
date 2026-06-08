# SalonStream Bridge — Email Parser Edition

Listens to an IMAP mailbox for booking confirmation/reminder emails, parses appointment data, and forwards structured details to Zapier webhooks for WhatsApp message automation.

## The Problem

Ovatu (salon management platform) doesn't expose an API for appointment data and lacks webhook support. This makes it difficult to automate WhatsApp appointment reminders, directions, and follow-ups.

## The Solution

Instead of relying on an unavailable API, this bridge **reads booking emails** sent by the salon's scheduling system via IMAP. When a new booking email arrives, it:

1. **Detects** the email via IMAP IDLE (push) or polling
2. **Parses** key appointment fields: Location, Date, Service, Time, Phone
3. **Forwards** the structured data to a Zapier webhook URL
4. **Zapier triggers** WhatsApp messages (reminders, directions, follow-ups)

## Architecture

```
Salon Email → IMAP Server → SalonStream Bridge → Zapier Webhook → WhatsApp
    (sends booking       (IDLE/poll)    (parses fields)   (Zapier triggers Twilio/WA)
     emails)
```

## Prerequisites

- **Node.js 18+**
- **IMAP-enabled email account** where booking emails are delivered
  - For Gmail: use an [App Password](https://support.google.com/accounts/answer/185833)
  - For other providers: standard IMAP settings
- **A Zapier account** with a webhook trigger Zap

## Setup

1. **Clone the repo**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure `.env`:**
   ```bash
   cp .env.example .env
   # Edit .env with your IMAP credentials and Zapier webhook URL
   ```
4. **Run the bridge:**
   ```bash
   npm start
   ```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `IMAP_HOST` | Yes | - | IMAP server hostname (e.g., `imap.gmail.com`) |
| `IMAP_PORT` | No | `993` | IMAP server port |
| `IMAP_TLS` | No | `true` | Use TLS connection |
| `IMAP_USER` | Yes | - | IMAP mailbox email address |
| `IMAP_PASSWORD` | Yes | - | IMAP password or app password |
| `IMAP_MAILBOX` | No | `INBOX` | Mailbox folder to watch |
| `IMAP_POLL_INTERVAL` | No | `30` | Poll interval in seconds (fallback if IDLE not supported) |
| `ZAPIER_WEBHOOK_URL` | Yes | - | Zapier webhook URL for forwarding appointment data |

## Email Format

The parser extracts fields from booking emails using these patterns:

| Field | Pattern |
|-------|---------|
| **Location** | `Location: <value>` |
| **Date** | `Date: <value>` |
| **Service** | `Service: <value>` |
| **Time** | `Time: <value>` |
| **Phone** | Line near "is the number we have on file" |

## Development

### Run tests
```bash
node test.js
```

### Test with sample data
The test file includes sample booking emails that exercise the parser with different formats.

### Files

```
App/
├── index.js            # Main entry point — starts IMAP listener
├── imap-listener.js    # IMAP client with IDLE support
├── email-parser.js     # Booking email field extractor
├── webhook-sender.js   # Zapier webhook dispatcher
├── test.js             # Parser tests with sample emails
├── package.json
├── .env.example
└── README.md
```

## License

MIT — SalonStream Team