import { getStripe, isStripeConfigured } from '../../lib/stripe';
import { getPlanById, getPlanByPriceId } from '../../lib/pricing';

/**
 * POST /api/checkout — create a Stripe Checkout Session for a subscription tier.
 *
 * Body: { priceId?, plan?, email?, userId?, successUrl?, cancelUrl? }
 *   - `priceId` (Stripe Price ID) or `plan` (`lite` | `pro` | `agency`).
 *   - `userId` is stored as `client_reference_id` so the webhook can map the
 *     completed checkout back to a SalonStream user.
 *
 * Returns `{ url, sessionId }` — redirect the browser to `url`.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isStripeConfigured()) {
    return res.status(503).json({ error: 'STRIPE_SECRET_KEY is not configured' });
  }

  const stripe = getStripe();
  const body = req.body || {};
  const { priceId, plan: planId, email, userId, successUrl, cancelUrl } = body;

  const plan = priceId ? getPlanByPriceId(priceId) : getPlanById(planId);
  if (!plan) {
    return res.status(400).json({ error: 'Unknown plan or price id' });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || deriveBaseUrl(req);
  const success = successUrl || `${baseUrl}/pricing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancel = cancelUrl || `${baseUrl}/pricing/cancel`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: success,
      cancel_url: cancel,
      client_reference_id: userId || undefined,
      customer_email: email || undefined,
      metadata: { plan: plan.id },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return res.status(200).json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error('[checkout] Failed to create Checkout Session:', error.message);
    return res.status(500).json({ error: error.message });
  }
}

/** Best-effort absolute origin, preferring forwarded headers behind a proxy. */
function deriveBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${proto}://${host}`;
}
