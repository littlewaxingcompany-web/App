/**
 * Shared pricing configuration for SalonStream subscription tiers.
 *
 * `priceId` values are the live Stripe Price IDs for each recurring tier.
 * They are referenced both by the pricing page (display) and the checkout API
 * route (to create a Stripe Checkout Session in "subscription" mode). Keep
 * these in sync with the Products/Prices configured in the Stripe dashboard.
 */
export const CURRENCY = 'gbp';

export const PLANS = [
  {
    id: 'lite',
    name: 'Lite',
    monthlyPrice: 15,
    priceId: 'price_1UHnmKRnGlKnVLQnijE9ohzI',
    tagline: 'For solo salons getting started',
    description: 'Automate up to 50 bookings a month.',
    features: [
      'Up to 50 bookings / month',
      'Booking confirmations via WhatsApp',
      'Ovatu email inbox automation',
      'Email support',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 49,
    priceId: 'price_1UHnmKRnGlKnVLQneQolc0wr',
    tagline: 'For growing salons',
    description: 'Unlimited bookings with direct WhatsApp integration.',
    features: [
      'Unlimited bookings',
      'Direct WhatChimp WhatsApp integration',
      'Reminders, follow-ups & marketing messages',
      'Priority support',
    ],
    highlight: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    monthlyPrice: 149,
    priceId: 'price_1UHnmKRnGlKnVLQnIALlBfd4',
    tagline: 'For multi-location groups & agencies',
    description: 'Manage every salon location from one account.',
    features: [
      'Multi-location management',
      'Everything in Pro',
      'Centralised billing & reporting',
      'Dedicated onboarding',
    ],
    highlight: false,
  },
];

/** Return a plan by its internal id (`lite` | `pro` | `agency`). */
export function getPlanById(id) {
  return PLANS.find((p) => p.id === id) || null;
}

/** Return a plan by its Stripe Price ID. */
export function getPlanByPriceId(priceId) {
  return PLANS.find((p) => p.priceId === priceId) || null;
}

/** Human-readable monthly price, e.g. "£15". */
export function formatPrice(plan) {
  return `£${plan.monthlyPrice}`;
}
