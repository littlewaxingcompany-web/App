# Production Deployment Guide

This document explains how to deploy the SalonStream Bridge for 24/7 production use.

## Architecture Overview

The bridge has **two modes**:

### Mode 1: IMAP (Recommended for Production)
Connects directly to an IMAP mailbox (e.g., Gmail, Outlook) to monitor for booking emails in real-time. Uses IMAP IDLE for push notifications — emails are processed within seconds of arrival. This mode runs 24/7 with no manual intervention.

### Mode 2: Agent (Used for Testing)
Uses the platform's API-based inbox tools. Suitable for testing and manual processing, but NOT recommended for production due to the need for an active agent session.

**Production recommendation: Mode 1 (IMAP).** Forward your Ovatu booking emails to a standard IMAP-capable email account, then configure the bridge to watch that inbox.

---

## 1. Prerequisites

- **Node.js 18+** — [Download here](https://nodejs.org/)
- **npm** — Comes with Node.js
- **A Gmail account** (or any IMAP-capable email provider) — To receive forwarded booking emails
- **A Zapier account** — With a Webhook-triggered Zap set up for WhatsApp messages

## 2. Email Setup (Gmail Recommended)

### Option A: Forward to a Dedicated Gmail Account (Easiest)

1. Create a free Gmail account (e.g., `salon-booking-bridge@gmail.com`)
2. Enable **2-Factor Authentication** on the account
3. Generate an **App Password**:
   - Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and your device, then click "Generate"
   - Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
4. Forward booking emails from Ovatu to this Gmail address

### Option B: Use Your Existing Email

If your existing email provider supports IMAP (most do), use those credentials directly. Common IMAP settings:

| Provider | IMAP Host | Port | TLS |
|----------|-----------|------|-----|
| Gmail | `imap.gmail.com` | `993` | Yes |
| Outlook/Hotmail | `outlook.office365.com` | `993` | Yes |
| Yahoo | `imap.mail.yahoo.com` | `993` | Yes |
| iCloud | `imap.mail.me.com` | `993` | Yes |

## 3. Installation

```bash
# Clone the repository
git clone https://github.com/littlewaxingcompany-web/App.git salonstream-bridge
cd salonstream-bridge

# Install dependencies
npm install
```

## 4. Configuration

Create a `.env` file in the project root:

```env
# ─── IMAP Mailbox ──────────────────────────────────────────────────────────
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_TLS=true
IMAP_USER=salon-booking-bridge@gmail.com
IMAP_PASSWORD=abcd efgh ijkl mnop    # App Password (use spaces as shown)
IMAP_MAILBOX=INBOX
IMAP_POLL_INTERVAL=30

# ─── Email Filters ─────────────────────────────────────────────────────────
EMAIL_FILTER_SENDER=reservations@ovatu.com
EMAIL_FILTER_SUBJECT=thankyou for your booking at the

# ─── Zapier Webhook ────────────────────────────────────────────────────────
ZAPIER_WEBHOOK_URL=https://hooks.zapier.com/hooks/catch/your-webhook-id
```

⚠️ **Important:** Never commit the `.env` file to version control. It's already in `.gitignore`.

## 5. Running the Bridge

### Quick Test
```bash
npm start
```

This runs the bridge in the foreground. You should see:
```
Connected! Watching mailbox: INBOX
Entering IDLE mode (waiting for new emails)...
```

Send a test booking email to confirm it works.

### Production: Run with pm2 (Background Service)

[pm2](https://pm2.keymetrics.io/) keeps the bridge running 24/7, restarts it if it crashes, and starts on system boot.

#### Install pm2
```bash
npm install -g pm2
```

#### Start the Bridge
```bash
pm2 start index.js --name "salonstream-bridge"
```

#### Other Useful pm2 Commands
```bash
pm2 status                    # Check if running
pm2 logs salonstream-bridge   # View live logs
pm2 restart salonstream-bridge # Restart the service
pm2 stop salonstream-bridge   # Stop the service

# Auto-start on server reboot
pm2 startup
pm2 save
```

### Alternative: systemd (Linux Servers)

Create a systemd service file at `/etc/systemd/system/salonstream-bridge.service`:

```ini
[Unit]
Description=SalonStream Bridge - Email to Zapier
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/salonstream-bridge
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable salonstream-bridge
sudo systemctl start salonstream-bridge
sudo systemctl status salonstream-bridge
```

## 6. How It Works (Production Flow)

```
Ovatu sends booking email → forwarded to Gmail inbox
→ Bridge detects new email (IMAP IDLE push)
→ email-parser.js extracts appointment fields
→ webhook-sender.js POSTs data to Zapier
→ Zapier triggers WhatsApp message to client
```

The bridge processes emails in **real-time** — typically within 1-5 seconds of arrival.

## 7. Monitoring & Troubleshooting

### Check Logs
```bash
# pm2 logs
pm2 logs salonstream-bridge

# Or if running as systemd
journalctl -u salonstream-bridge -f
```

### Common Issues

| Problem | Solution |
|---------|----------|
| "Connection failed" | Check IMAP_HOST, IMAP_USER, IMAP_PASSWORD in `.env` |
| "Invalid credentials" | For Gmail, use an **App Password**, not your regular password |
| No emails detected | Check that booking emails are actually being forwarded to this inbox |
| Zapier returns error | Verify ZAPIER_WEBHOOK_URL is correct |

### Testing the Pipeline
```bash
# Send a test email to the monitored inbox with this format:
# Subject: "Thankyou for your booking at the Little Waxing Company"
# Body includes: Location:, Date:, Service:, Time: and phone + "is the number we have on file"

# Then check the logs:
pm2 logs salonstream-bridge
```

Expected output:
```
[ImapListener] Found 1 new email(s).
[EmailParser] Extracted: { location: 'Sunderland', date: 'June 20, 2026', ... }
[WebhookSender] Success! Status: 200
```

## 8. File Reference

```
├── index.js             # Entry point — starts IMAP listener (production)
├── imap-listener.js     # IMAP client with IDLE support (production mode)
├── email-parser.js      # Booking email field extractor
├── webhook-sender.js    # Zapier webhook dispatcher
├── inbox-agent.js       # Agent CLI tool (testing mode — NOT for production)
├── test.js              # Test suite (run: node test.js)
├── .env                 # Your configuration (create this)
├── .env.example         # Template for .env
├── package.json
└── PRODUCTION.md        # This file
```

## 9. Cost Summary

| Component | Cost |
|-----------|------|
| Node.js + pm2 | Free (open source) |
| Gmail account | Free |
| Zapier account | Free tier available (paid plans for higher volume) |
| WhatsApp messages | Via Zapier's WhatsApp integration (usage-based) |
| Hosting (VPS) | ~$5-10/month (DigitalOcean, Linode, AWS EC2, etc.) |

**Total: ~$5-10/month** plus any Zapier/WhatsApp usage fees.

## 10. Final Checklist

- [ ] Gmail account created and configured with App Password
- [ ] Ovatu booking emails forwarding to the monitored inbox
- [ ] `.env` file created with correct IMAP and Zapier credentials
- [ ] `npm install` completed
- [ ] `npm start` test run — bridge connects and waits
- [ ] Test email sent — bridge parses and forwards to Zapier (HTTP 200)
- [ ] pm2 running the bridge: `pm2 start index.js --name "salonstream-bridge"`
- [ ] pm2 configured for auto-start: `pm2 startup && pm2 save`

---

*SalonStream Bridge — Built for The Little Waxing Company*