import { getStripe, isStripeConfigured } from '../../../lib/stripe';
import { getPlanById, getPlanByPriceId } from '../../../lib/pricing';
import { isConfigured, query } from '../../../lib/db';

/**
 * Disable Next.js' built-in body parser — Stripe webhook signature
 * verification requires the raw request body.
 */
export const config = {
  api: { bodyParser: false },
};

/**
 * POST /api/webhooks/stripe — handle Stripe events.
 *
 * Configure this URL in the Stripe dashboard (Developers → Webhooks) as:
 *   https://<your-domain>/api/webhooks/stripe
 * Select the `checkout.session.completed`, `customer.subscription.updated` and
 * `customer.subscription.deleted` events, then copy the signing secret into
 * STRIPE_WEBHOOK_SECRET.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stripe = getStripe();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Stripe webhook is not configured' });
  }

  const signature = req.headers['stripe-signature'];
  let event;
  try {
    const rawBody = await readRawBody(req);
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error('[stripe-webhook] Signature verification failed:', error.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${error.message}` });
  }

  // Acknowledge receipt even if DB sync fails, so Stripe doesn't retry forever.
  // Any persistence errors are logged and surfaced in the server logs.
  try {
    await handleEvent(event);
  } catch (error) {
    console.error('[stripe-webhook] Event handling failed:', error.message);
  }

  return res.status(200).json({ received: true });
}

async function handleEvent(event) {
  switch (event.type) {
    case 'checkout.session.completed':
      return syncFromCheckout(event.data.object);
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return syncFromSubscription(event.data.object);
    default:
      return null;
  }
}

/**
 * Map a completed checkout back to a SalonStream user and set their plan.
 * Prefers `client_reference_id` (our user id), falling back to email match.
 */
async function syncFromCheckout(session) {
  const plan = getPlanById(session.metadata?.plan);
  if (!plan) return;

  const email = session.customer_email || session.customer_details?.email || null;
  const customerId = session.customer || null;
  const subscriptionId = session.subscription || null;

  if (!isConfigured()) {
    console.warn('[stripe-webhook] DATABASE_URL not configured; skipping plan sync.');
    return;
  }

  let matched = 0;

  if (session.client_reference_id) {
    const { rows } = await query(
      `UPDATE users
          SET plan = $1, stripe_customer_id = $2, stripe_subscription_id = $3
        WHERE id = $4
        RETURNING id`,
      [plan.id, customerId, subscriptionId, session.client_reference_id]
    );
    matched = rows.length;
  }

  if (matched === 0 && email) {
    const { rows } = await query(
      `UPDATE users
          SET plan = $1, stripe_customer_id = $2, stripe_subscription_id = $3
        WHERE email = $4
        RETURNING id`,
      [plan.id, customerId, subscriptionId, email]
    );
    matched = rows.length;
  }

  console.log(`[stripe-webhook] checkout completed → plan "${plan.id}" (matched ${matched} user(s))`);
}

/**
 * Keep a user's plan in sync when a subscription renews, is updated or is
 * cancelled. Active/trialing subscriptions resolve to the tier of the first
 * line-item price; anything else falls back to Lite.
 */
async function syncFromSubscription(subscription) {
  if (!isConfigured()) {
    console.warn('[stripe-webhook] DATABASE_URL not configured; skipping plan sync.');
    return;
  }

  const status = subscription.status;
  let planId = null;

  if (status === 'active' || status === 'trialing') {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const plan = priceId ? getPlanByPriceId(priceId) : null;
    planId = plan ? plan.id : null;
  } else {
    planId = 'lite';
  }

  if (!planId || !subscription.id) return;

  const { rows } = await query(
    `UPDATE users
        SET plan = $1, stripe_subscription_id = $2
      WHERE stripe_subscription_id = $3
      RETURNING id`,
    [planId, subscription.id, subscription.id]
  );

  console.log(`[stripe-webhook] subscription ${status} → plan "${planId}" (matched ${rows.length} user(s))`);
}

/** Read the raw request body (requires `bodyParser: false`). */
async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}
