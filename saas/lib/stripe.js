import Stripe from 'stripe';

let stripeClient = null;

/**
 * Lazily initialise the Stripe server client. Returns `null` when
 * STRIPE_SECRET_KEY is not configured so callers can degrade gracefully —
 * mirrors the provider-agnostic `lib/db.js` pattern.
 */
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

/** True when a Stripe secret key is configured. */
export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
