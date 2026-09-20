import Layout from '../components/Layout';
import OnboardingFlow from '../components/OnboardingFlow';

/**
 * Onboarding page — walks a salon owner through configuring their first salon.
 */
export default function Onboarding() {
  return (
    <Layout title="Set up your salon">
      <p className="muted">
        A couple of quick steps to connect your Ovatu bookings to WhatsApp.
      </p>
      <OnboardingFlow />
    </Layout>
  );
}
