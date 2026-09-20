/**
 * Slug helpers for the SalonStream forwarding-email addresses.
 *
 * A salon's `slug` is the local part of its unique inbound email address,
 * e.g. `<slug>@salonstream.app`. It must be URL-safe and globally unique
 * (enforced by a unique index on `salons.slug`).
 */

/** Domain used for forwarding addresses. Override with an env var if needed. */
export const FORWARDING_EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_FORWARDING_EMAIL_DOMAIN || 'salonstream.app';

/**
 * Turn an arbitrary salon name into a URL-safe slug.
 *   "The Little Waxing Company!" → "the-little-waxing-company"
 */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')          // drop apostrophes (no "little's" → "littles")
    .replace(/[^a-z0-9]+/g, '-')   // runs of non-alphanumerics → single hyphen
    .replace(/^-+|-+$/g, '')       // trim leading/trailing hyphens
    .slice(0, 60);
}

/** Normalise a user-typed slug (same rules as `slugify`). */
export function normalizeSlug(input) {
  return slugify(input);
}

/** Validate a final slug: lowercase letters, digits and hyphens only. */
export function isValidSlug(slug) {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug || '');
}

/** The full forwarding email address for a slug. */
export function forwardingEmail(slug) {
  return `${slug}@${FORWARDING_EMAIL_DOMAIN}`;
}
