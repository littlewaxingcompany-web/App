/**
 * IMAP Listener
 * 
 * Connects to an IMAP mailbox and listens for new booking emails in real-time.
 * Uses the IDLE command for push notifications (IMAP IDLE extension).
 * 
 * When a new email arrives, it parses it using EmailParser and forwards
 * the structured data to the WebhookSender (Zapier).
 */

const { ImapFlow } = require('imapflow');
const EmailParser = require('./email-parser');

class ImapListener {
  /**
   * @param {Object} config - IMAP configuration
   * @param {string} config.host - IMAP server hostname
   * @param {number} config.port - IMAP server port (default: 993)
   * @param {boolean} config.tls - Use TLS (default: true)
   * @param {string} config.user - IMAP username
   * @param {string} config.password - IMAP password
   * @param {string} config.mailbox - Mailbox to watch (default: 'INBOX')
   * @param {Object} [webhookSender] - Optional WebhookSender instance to forward parsed emails
   */
  constructor(config, webhookSender = null) {
    this.config = {
      host: config.host,
      port: config.port || 993,
      tls: config.tls !== false,
      auth: {
        user: config.user,
        pass: config.password,
      },
      mailbox: config.mailbox || 'INBOX',
      logger: false, // reduce noise
    };
    this.webhookSender = webhookSender;
    this.parser = new EmailParser();
    this.client = null;
    this.running = false;
    this.pollIntervalMs = config.pollIntervalMs || 30000; // 30s poll fallback
    this._pollTimer = null;
  }

  /**
   * Start listening for new emails.
   * Uses IMAP IDLE when available, falls back to polling.
   * 
   * @param {Function} [onEmail] - Callback for each new email (if webhookSender not set)
   */
  async start(onEmail) {
    this.running = true;
    this._onEmail = onEmail || this._defaultHandler.bind(this);

    console.log(`[ImapListener] Connecting to ${this.config.host}:${this.config.port}...`);
    
    this.client = new ImapFlow(this.config);
    
    try {
      await this.client.connect();
      console.log(`[ImapListener] Connected! Watching mailbox: ${this.config.mailbox}`);
      
      await this.client.mailboxOpen(this.config.mailbox);
      
      // Start the main loop
      await this._watchLoop();
    } catch (error) {
      console.error(`[ImapListener] Connection failed:`, error.message);
      console.log(`[ImapListener] Will retry in ${this.pollIntervalMs / 1000}s...`);
      
      // Schedule retry
      setTimeout(() => {
        if (this.running) {
          this.start(onEmail).catch(err => {
            console.error(`[ImapListener] Retry failed:`, err.message);
          });
        }
      }, this.pollIntervalMs);
    }
  }

  /**
   * Main watch loop: IDLE when supported, poll as fallback.
   */
  async _watchLoop() {
    while (this.running) {
      try {
        // Check for new mail using IDLE (push) or polling
        if (this.client.idle) {
          await this._idleWait();
        } else {
          await this._pollCheck();
          await this._sleep(this.pollIntervalMs);
        }
      } catch (error) {
        console.error(`[ImapListener] Watch loop error:`, error.message);
        // Reconnect on error
        try {
          await this.client.reconnect();
          console.log(`[ImapListener] Reconnected.`);
        } catch (reconnectError) {
          console.error(`[ImapListener] Reconnect failed:`, reconnectError.message);
          await this._sleep(10000);
        }
      }
    }
  }

  /**
   * Use IMAP IDLE to wait for new messages (push notifications).
   */
  async _idleWait() {
    console.log(`[ImapListener] Entering IDLE mode (waiting for new emails)...`);
    
    const lock = await this.client.getMailboxLock(this.config.mailbox);
    try {
      const waitPromise = this.client.idle.wait();
      
      // Check for new mail after IDLE signals
      const status = await this.client.status(this.config.mailbox, { messages: true, unseen: true });
      console.log(`[ImapListener] IDLE woke up. Unseen: ${status.unseen || 0}`);
      
      // Fetch unseen messages
      if (status.unseen > 0) {
        await this._fetchNewEmails();
      }
      
      await waitPromise;
    } finally {
      lock.release();
    }
  }

  /**
   * Poll for new messages as fallback when IDLE isn't supported.
   */
  async _pollCheck() {
    const lock = await this.client.getMailboxLock(this.config.mailbox);
    try {
      const status = await this.client.status(this.config.mailbox, { messages: true, unseen: true });
      
      if (status.unseen && status.unseen > 0) {
        console.log(`[ImapListener] Poll found ${status.unseen} unseen message(s).`);
        await this._fetchNewEmails();
      }
    } finally {
      lock.release();
    }
  }

  /**
   * Fetch new/unseen emails and process them.
   */
  async _fetchNewEmails() {
    try {
      // Search for unseen messages
      const searchResult = await this.client.search({ unseen: true });
      
      if (!searchResult || searchResult.length === 0) {
        console.log(`[ImapListener] No new unseen emails found.`);
        return;
      }

      console.log(`[ImapListener] Found ${searchResult.length} new email(s).`);

      for (const seq of searchResult) {
        try {
          const message = await this.client.fetchOne(seq, { source: true, uid: true });
          
          if (message && message.source) {
            await this._processEmail(message.source, message.uid);
          }
        } catch (fetchError) {
          console.error(`[ImapListener] Error fetching email #${seq}:`, fetchError.message);
        }
      }
    } catch (error) {
      console.error(`[ImapListener] Error searching emails:`, error.message);
    }
  }

  /**
   * Process a single email: parse and forward.
   * 
   * @param {Buffer} rawEmail - Raw email source
   * @param {number} uid - IMAP UID
   */
  async _processEmail(rawEmail, uid) {
    try {
      const appointment = await this.parser.parseRaw(rawEmail);
      
      // Only forward if it looks like a booking email
      if (!this.parser.isBookingEmail({ subject: appointment.subject, text: appointment._rawBody })) {
        console.log(`[ImapListener] Email #${uid} is not a booking email, skipping.`);
        return;
      }

      console.log(`[ImapListener] New booking email #${uid}: ${appointment.subject}`);

      if (this._onEmail) {
        await this._onEmail(appointment);
      }
    } catch (error) {
      console.error(`[ImapListener] Error processing email #${uid}:`, error.message);
    }
  }

  /**
   * Default handler: forward to webhook sender if configured.
   */
  async _defaultHandler(appointment) {
    if (this.webhookSender) {
      await this.webhookSender.sendAppointment(appointment);
    } else {
      console.log(`[ImapListener] No webhook sender configured. Appointment data:`, 
        JSON.stringify(appointment, null, 2));
    }
  }

  /**
   * Stop the listener.
   */
  async stop() {
    this.running = false;
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
    }
    if (this.client && this.client.idle) {
      this.client.idle.stop();
    }
    if (this.client) {
      await this.client.logout();
    }
    console.log(`[ImapListener] Stopped.`);
  }

  /**
   * Sleep helper.
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = ImapListener;