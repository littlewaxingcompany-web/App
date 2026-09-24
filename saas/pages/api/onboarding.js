import { getPool, isConfigured, query } from '../../lib/db';
import {
  normalizeSlug,
  isValidSlug,
  forwardingEmail,
  FORWARDING_EMAIL_DOMAIN,
} from '../../lib/slug';

/**
 * POST /api/onboarding — save a salon owner's first salon and its messaging
 * configuration.
 *
 * Body: { name, slug, address?, whatchimpApiToken?, whatchimpPhoneNumberId?,
 *         whatchimpTemplateName?, userId?, email? }
 *
 * `userId`/`email` are optional. When neither is supplied (auth not yet wired),
 * a placeholder owner user is created so the salon has a tenant to attach to.
 * On success the route returns the created userId/salonId plus the forwarding
 * email. A taken slug returns 409 with a `suggestedSlug`.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isConfigured()) {
    return res.status(503).json({ error: 'DATABASE_URL is not configured' });
  }

  const body = req.body || {};
  const name = String(body.name || '').trim();
  const slug = normalizeSlug(body.slug);
  const address = String(body.address || '').trim();
  const whatchimpApiToken = String(
    body.whatchimpApiToken || body.whatchimp_api_token || ''
  ).trim();
  const whatchimpPhoneNumberId = String(
    body.whatchimpPhoneNumberId || body.whatchimp_phone_number_id || ''
  ).trim();
  const whatchimpTemplateName = String(
    body.whatchimpTemplateName || body.whatchimp_template_name || ''
  ).trim();
  const userId = body.userId || null;
  const email = body.email || null;

  if (!name) {
    return res.status(400).json({ error: 'Salon name is required.' });
  }
  if (!isValidSlug(slug)) {
    return res.status(400).json({
      error: 'Salon slug can only contain lowercase letters, numbers and hyphens.',
    });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(503).json({ error: 'DATABASE_URL is not configured' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Resolve the owner user (prefer explicit id, then email, then placeholder).
    let ownerId = null;
    if (userId) {
      const existing = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      ownerId = existing.rows[0]?.id || null;
    }
    if (!ownerId && email) {
      const byEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (byEmail.rows[0]) {
        ownerId = byEmail.rows[0].id;
      } else {
        const created = await client.query(
          'INSERT INTO users (email) VALUES ($1) RETURNING id',
          [email]
        );
        ownerId = created.rows[0].id;
      }
    }
    if (!ownerId) {
      const placeholder = `owner@${slug}.${FORWARDING_EMAIL_DOMAIN}`;
      const created = await client.query(
        'INSERT INTO users (email) VALUES ($1) RETURNING id',
        [placeholder]
      );
      ownerId = created.rows[0].id;
    }

    const inserted = await client.query(
      `INSERT INTO salons
         (user_id, name, slug, address,
          whatchimp_api_token, whatchimp_phone_number_id, whatchimp_template_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, slug`,
      [
        ownerId,
        name,
        slug,
        address || null,
        whatchimpApiToken || null,
        whatchimpPhoneNumberId || null,
        whatchimpTemplateName || null,
      ]
    );

    await client.query('COMMIT');

    const salon = inserted.rows[0];
    return res.status(201).json({
      userId: ownerId,
      salonId: salon.id,
      slug: salon.slug,
      forwardingEmail: forwardingEmail(salon.slug),
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505' && /slug/i.test(String(error.constraint || error.message))) {
      const suggestedSlug = await suggestSlug(slug);
      return res.status(409).json({
        error: 'That salon slug is already taken.',
        suggestedSlug,
      });
    }
    console.error('[onboarding] Failed to save salon:', error.message);
    return res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
}

/** Find the first free `<base>-<n>` slug for a taken base. */
async function suggestSlug(base) {
  for (let i = 2; i <= 100; i++) {
    const candidate = `${base}-${i}`;
    const { rows } = await query('SELECT 1 FROM salons WHERE slug = $1', [candidate]);
    if (rows.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
