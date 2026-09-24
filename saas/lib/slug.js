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

/**
 * Extract the salon slug from a forwarding-email address (the local part before
 * `@`). Returns the normalized slug when the address uses the configured
 * forwarding domain, otherwise `null`.
 *
 * Accepts a bare address ("foo@salonstream.app") or one with a display name
 * ("My Salon <foo@salonstream.app>"). Used to resolve the tenant from an
 * inbound email's recipient (To) address.
 */
export function slugFromAddress(address) {
  if (!address) return null;
  const match = String(address).match(/<?([^<>\s@]+)@([^<>\s@]+)>?/);
  if (!match) return null;
  const local = match[1];
  const domain = match[2].toLowerCase();
  if (domain !== FORWARDING_EMAIL_DOMAIN.toLowerCase()) return null;
  const slug = normalizeSlug(local);
  return isValidSlug(slug) ? slug : null;
}
