import { useState } from 'react';
import { WHATSAPP_CONNECT_URL } from '../lib/whatsapp-connect';

/**
 * Dashboard panel where a logged-in salon owner can see, connect, replace or
 * clear their WhatsApp connection. The stored Connection ID is always masked —
 * only its last 4 characters are shown.
 */
export default function ConnectionPanel({ salon, userId, onUpdated }) {
  const [connectionId, setConnectionId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const stored = salon?.whatchimp_instance_id || null;
  const last4 = stored ? stored.slice(-4) : null;

  function openConnect() {
    // Opens the Coexistence connection page (QR-code flow) in a new tab. The
    // owner completes the flow there and copies back the Connection ID.
    window.open(WHATSAPP_CONNECT_URL, '_blank', 'noopener,noreferrer');
  }

  async function save() {
    const value = connectionId.trim();
    if (!value) {
      setError('Please paste your WhatsApp Connection ID first.');
      setNotice(null);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/salon/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, connection_id: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save the connection.');
      onUpdated({ ...salon, whatchimp_instance_id: value });
      setConnectionId('');
      setNotice('WhatsApp connected.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/salon/connection?user_id=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect.');
      onUpdated({ ...salon, whatchimp_instance_id: null });
      setConnectionId('');
      setNotice('WhatsApp disconnected.');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card connection-panel">
      <div className="connection-head">
        <h2 className="section-title">WhatsApp connection</h2>
        {stored ? (
          <span className="status-pill live">
            <span className="status-dot" aria-hidden="true" />
            Connected · •••• {last4}
          </span>
        ) : (
          <span className="status-pill waiting">
            <span className="status-dot" aria-hidden="true" />
            Not connected
          </span>
        )}
      </div>

      <p className="muted">
        SalonStream sends confirmations through your own WhatsApp Business
        number. Connect it once here — or update it any time.
      </p>

      <div className="connection-cta">
        <button className="btn btn-whatsapp" type="button" onClick={openConnect}>
          {stored ? 'Reconnect WhatsApp' : 'Connect WhatsApp'}
        </button>
      </div>

      <label className="field">
        <span>WhatsApp Connection ID</span>
        <input
          type="text"
          value={connectionId}
          placeholder={stored ? `Current ends in ${last4}` : 'e.g. 275484922308471'}
          onChange={(e) => setConnectionId(e.target.value)}
        />
        <span className="hint">
          After you connect, a Connection ID (also called a Phone number ID) is
          shown on the confirmation screen — paste it here and save.
        </span>
      </label>

      <div className="step-actions">
        <button className="btn" type="button" onClick={save} disabled={busy}>
          {busy ? 'Saving…' : stored ? 'Update Connection ID' : 'Save Connection ID'}
        </button>
        {stored ? (
          <button className="btn btn-danger" type="button" onClick={disconnect} disabled={busy}>
            Disconnect
          </button>
        ) : null}
      </div>

      {error ? <p className="form-error">⚠️ {error}</p> : null}
      {notice ? <p className="form-notice">{notice}</p> : null}
    </section>
  );
}
