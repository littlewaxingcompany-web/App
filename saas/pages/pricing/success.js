import Layout from '../../components/Layout';

/**
 * Post-checkout success page. Stripe redirects here with `?session_id=...`
 * (via `{CHECKOUT_SESSION_ID}`). The plan is applied server-side by the
 * `checkout.session.completed` webhook.
 */
export default function CheckoutSuccess() {
  return (
    <Layout title="You're all set! 🎉">
      <div className="card">
        <p>
          Your subscription is being activated. Your plan will appear on the
          dashboard within a few moments.
        </p>
        <p className="muted">
          A receipt will be emailed to you by Stripe. If you don&apos;t see your
          plan update shortly, refresh this page or contact support.
        </p>
        <a className="btn" href="/dashboard">Go to dashboard →</a>
      </div>
    </Layout>
  );
}
