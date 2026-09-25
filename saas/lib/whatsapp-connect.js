/**
 * URL of the WhatsApp Coexistence connection page, opened when a salon owner
 * clicks "Connect WhatsApp" (during onboarding and on the dashboard). The
 * owner completes the QR-code flow there and copies back a Connection ID.
 *
 * Env var (preferred):  NEXT_PUBLIC_WHATSAPP_CONNECT_URL
 * Deprecated legacy:    NEXT_PUBLIC_WHATCHIMP_CONNECT_URL — still honoured as a
 *                       fallback so existing deployments don't silently revert
 *                       to the default.
 */
export const WHATSAPP_CONNECT_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_CONNECT_URL ||
  process.env.NEXT_PUBLIC_WHATCHIMP_CONNECT_URL ||
  'https://app.whatchimp.com/whatsapp/bot/connect';
