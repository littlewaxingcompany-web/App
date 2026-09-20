import Layout from '../../components/Layout';

/**
 * Checkout cancellation page. Stripe redirects here when the customer backs
 * out of the hosted checkout before paying.
 */
export default function CheckoutCancel() {
  return (
    <Layout title="Checkout cancelled">
      <div className="card">
        <p>No payment was taken and your plan has not changed.</p>
        <p className="muted">
          You can try again whenever you&apos;re ready, or get in touch if you ran
          into any trouble.
        </p>
        <a className="btn" href="/pricing">Back to pricing</a>
      </div>
    </Layout>
  );
}
