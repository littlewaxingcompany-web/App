import { useState } from 'react';
import Layout from '../components/Layout';
import { PLANS, formatPrice } from '../lib/pricing';

/**
 * Pricing page — renders the Lite / Pro / Agency tiers and starts a Stripe
 * Checkout Session when a "Subscribe" button is clicked.
 */
export default function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [error, setError] = useState(null);

  async function subscribe(plan) {
    setLoadingPlan(plan.id);
    setError(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: plan.priceId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start checkout');
      }
      if (!data.url) {
        throw new Error('Checkout session did not return a URL');
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoadingPlan(null);
    }
  }

  return (
    <Layout title="Pricing">
      <p className="muted">
        Simple monthly pricing. Cancel anytime — every plan includes the Ovatu
        email inbox and direct WhatsApp messaging.
      </p>

      {error ? <div className="card">⚠️ {error}</div> : null}

      <div className="pricing-grid">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`plan${plan.highlight ? ' highlighted' : ''}`}
          >
            {plan.highlight ? <span className="badge">Most popular</span> : null}
            <h2>{plan.name}</h2>
            <div className="price">
              {formatPrice(plan)}
              <span className="muted">/month</span>
            </div>
            <p className="muted">{plan.description}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button
              className={plan.highlight ? 'btn' : 'btn btn-outline'}
              disabled={loadingPlan !== null}
              onClick={() => subscribe(plan)}
            >
              {loadingPlan === plan.id ? 'Redirecting…' : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>

      <p className="muted small">
        Payments are processed securely by Stripe. You&apos;ll be redirected to
        Stripe&apos;s hosted checkout and returned here when complete.
      </p>
    </Layout>
  );
}
