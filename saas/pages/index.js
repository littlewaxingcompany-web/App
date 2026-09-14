import Layout from '../components/Layout';

/**
 * Landing page — marketing + signup CTA.
 */
export default function Home() {
  return (
    <Layout>
      <section className="hero">
        <h1>WhatsApp automation for salon owners — without the Zapier bill.</h1>
        <p className="muted">
          SalonStream turns your Ovatu booking emails into personalized WhatsApp
          reminders, confirmations and follow-ups. Direct WhatChimp integration,
          no Zapier required.
        </p>
        <a className="btn" href="/dashboard">Go to dashboard →</a>
      </section>

      <section className="grid">
        <div className="card">
          <h3>🔔 Automated reminders</h3>
          <p className="muted">Send booking confirmations and reminders the moment Ovatu emails you.</p>
        </div>
        <div className="card">
          <h3>💬 Direct WhatsApp</h3>
          <p className="muted">Native WhatChimp API — cut out the middleman and the monthly Zapier fee.</p>
        </div>
        <div className="card">
          <h3>📊 Multi-tenant dashboard</h3>
          <p className="muted">Manage multiple salon locations from one account (Agency plan).</p>
        </div>
      </section>
    </Layout>
  );
}
