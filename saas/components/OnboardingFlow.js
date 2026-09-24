import { useState } from 'react';
import Link from 'next/link';
import { slugify, isValidSlug, forwardingEmail } from '../lib/slug';

const STEPS = ['Salon profile', 'Messaging', 'Automation setup'];

/**
 * Multi-step onboarding flow for a salon owner's first salon.
 *   Step 0 — salon name, address, slug (auto-suggested from the name).
 *   Step 1 — WhatChimp messaging configuration.
 *   Step 2 — show the unique forwarding email + Ovatu setup instructions,
 *            then create the salon via POST /api/onboarding.
 */
export default function OnboardingFlow() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [apiToken, setApiToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState(null);
  const [suggestedSlug, setSuggestedSlug] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const normalizedSlug = slugify(slug);
  const emailAddress = forwardingEmail(normalizedSlug);

  function handleNameChange(value) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function validateStep0() {
    if (!name.trim()) return 'Please enter your salon name.';
    if (!isValidSlug(normalizedSlug)) {
      return 'Your salon slug can only contain lowercase letters, numbers and hyphens.';
    }
    return null;
  }

  function next() {
    setError(null);
    setSuggestedSlug(null);
    if (step === 0) {
      const err = validateStep0();
      if (err) {
        setError(err);
        return;
      }
    }
    setStep(step + 1);
  }

  function back() {
    setError(null);
    setSuggestedSlug(null);
    setStep(step - 1);
  }

  function useSuggestedSlug() {
    if (suggestedSlug) {
      setSlug(suggestedSlug);
      setSlugTouched(true);
    }
    setError(null);
    setSuggestedSlug(null);
    setStep(0);
  }

  async function complete() {
    setError(null);
    setSuggestedSlug(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: normalizedSlug,
          address: address.trim(),
          whatchimpApiToken: apiToken.trim(),
          whatchimpPhoneNumberId: phoneNumberId.trim(),
          whatchimpTemplateName: templateName.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && data.suggestedSlug) {
          setSuggestedSlug(data.suggestedSlug);
        }
        throw new Error(data.error || 'Failed to save your salon.');
      }
      if (data.userId) {
        try {
          localStorage.setItem('salonstream.userId', data.userId);
        } catch (_) {
          /* localStorage unavailable — non-fatal */
        }
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="card onboarding-success">
        <h2>Your salon is ready 🎉</h2>
        <p>
          Booking emails forwarded to{' '}
          <strong className="email">{result.forwardingEmail}</strong> will now be
          processed automatically.
        </p>
        <p className="muted">
          Finish the Ovatu forwarding setup below, then head to your dashboard to
          see bookings arrive.
        </p>
        <ForwardingInstructions slug={result.slug} email={result.forwardingEmail} />
        <Link className="btn" href="/dashboard">Go to dashboard →</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="steps" aria-label="Progress">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
          >
            <span className="step-num">{i < step ? '✓' : i + 1}</span>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      {error ? (
        <div className="card error-card">
          <span>⚠️ {error}</span>
          {suggestedSlug ? (
            <button className="btn btn-outline" onClick={useSuggestedSlug}>
              Use “{suggestedSlug}” instead
            </button>
          ) : null}
        </div>
      ) : null}

      {step === 0 ? (
        <section className="card">
          <h2>Tell us about your salon</h2>
          <label className="field">
            <span>Salon name</span>
            <input
              type="text"
              value={name}
              placeholder="The Little Waxing Company"
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Address</span>
            <input
              type="text"
              value={address}
              placeholder="123 High Street, Sunderland"
              onChange={(e) => setAddress(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Salon slug</span>
            <input
              type="text"
              value={slug}
              placeholder="the-little-waxing-company"
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugTouched(true);
              }}
            />
            <span className="hint">
              Used for your unique forwarding email:{' '}
              <strong>{emailAddress || 'your-slug@…'}</strong>
            </span>
          </label>

          <div className="step-actions">
            <button className="btn" onClick={next}>Continue →</button>
          </div>
        </section>
      ) : null}

      {step === 1 ? (
        <section className="card">
          <h2>Connect WhatChimp</h2>
          <p className="muted">
            SalonStream sends WhatsApp messages through WhatChimp. Add your
            credentials so reminders and confirmations reach your clients.
          </p>

          <label className="field">
            <span>WhatChimp API token</span>
            <input
              type="password"
              value={apiToken}
              placeholder="Your WhatChimp API key"
              onChange={(e) => setApiToken(e.target.value)}
            />
          </label>

          <label className="field">
            <span>WhatChimp phone number ID</span>
            <input
              type="text"
              value={phoneNumberId}
              placeholder="Your WhatsApp phone number ID"
              onChange={(e) => setPhoneNumberId(e.target.value)}
            />
          </label>

          <label className="field">
            <span>Template name</span>
            <input
              type="text"
              value={templateName}
              placeholder="booking_confirmation"
              onChange={(e) => setTemplateName(e.target.value)}
            />
          </label>

          <div className="step-actions">
            <button className="btn btn-outline" onClick={back}>← Back</button>
            <button className="btn" onClick={next}>Continue →</button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="card">
          <h2>Set up email forwarding in Ovatu</h2>
          <p>
            Your unique forwarding address is:
          </p>
          <div className="email-box">{emailAddress}</div>
          <ForwardingInstructions slug={normalizedSlug} email={emailAddress} />

          <div className="step-actions">
            <button className="btn btn-outline" onClick={back} disabled={submitting}>← Back</button>
            <button className="btn" onClick={complete} disabled={submitting}>
              {submitting ? 'Saving…' : 'Complete setup'}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ForwardingInstructions({ email }) {
  return (
    <ol className="instructions">
      <li>
        In <strong>Ovatu</strong>, go to <em>Settings → Notifications</em> (or
        wherever booking email notifications are configured).
      </li>
      <li>
        Add <strong>{email}</strong> as the recipient for new booking
        notifications.
      </li>
      <li>
        Optionally set up a forwarding rule in your inbox to send booking emails
        to <strong>{email}</strong>.
      </li>
      <li>
        SalonStream will read every incoming booking email, then send your client
        a personalised WhatsApp confirmation automatically.
      </li>
    </ol>
  );
}
