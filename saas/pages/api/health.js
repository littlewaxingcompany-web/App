/**
 * GET /api/health — liveness/readiness probe.
 */
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    service: 'salonstream-saas',
    time: new Date().toISOString(),
  });
}
