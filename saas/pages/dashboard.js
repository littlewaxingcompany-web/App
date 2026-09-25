import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import { forwardingEmail } from '../lib/slug';
import ConnectionPanel from '../components/ConnectionPanel';

/** How recent must the latest activity be for the inbox to show as "Live". */
const LIVE_WINDOW_MS = 15 * 60 * 1000;
/** Auto-refresh cadence for stats + activity (ms). */
const REFRESH_MS = 15000;

function timeAgo(iso, now) {
  if (!iso) return '';
  const diff = now - new Date(iso).getTime();
  if (diff < 60 * 1000) return 'just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const TYPE_META = {
  booking: { icon: '🗓️', label: 'New booking' },
  message_sent: { icon: '✅', label: 'Message sent' },
  message_failed: { icon: '⚠️', label: 'Message failed' },
  message_pending: { icon: '⏳', label: 'Message queued' },
};

/**
 * Dashboard — real-time stats and activity for the owner's salon. If the
 * owner has no salon yet, redirect into onboarding. Stats and activity
 * auto-refresh every 15s (with a manual Refresh button too).
 */
export default function Dashboard() {
  const router = useRouter();
  const [salon, setSalon] = useState(null);
  const [userId, setUserId] = useState(null);
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // 1. Resolve the owner's salon (or send them into onboarding).
  useEffect(() => {
    let active = true;

    const userId =
      typeof window !== 'undefined' ? localStorage.getItem('salonstream.userId') : null;

    if (!userId) {
      router.replace('/onboarding');
      return () => {
        active = false;
      };
    }

    setUserId(userId);

    fetch(`/api/salons?user_id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.salons && data.salons.length > 0) {
          setSalon(data.salons[0]);
        } else {
          router.replace('/onboarding');
        }
      })
      .catch(() => {
        if (active) router.replace('/onboarding');
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [router]);

  // 2. Load stats + activity for the resolved salon.
  const loadData = useCallback(async () => {
    if (!salon?.id) return;
    try {
      const [statsRes, actRes] = await Promise.all([
        fetch(`/api/stats?salon_id=${encodeURIComponent(salon.id)}`).then((r) => r.json()),
        fetch(`/api/activity?salon_id=${encodeURIComponent(salon.id)}`).then((r) => r.json()),
      ]);
      setStats(statsRes.stats || null);
      setActivity(actRes.activity || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
      setNow(Date.now());
    }
  }, [salon?.id]);

  useEffect(() => {
    if (!salon?.id) return;
    loadData();
    const timer = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(timer);
  }, [salon?.id, loadData]);

  if (checking) {
    return (
      <Layout title="Dashboard">
        <p className="muted">Loading…</p>
      </Layout>
    );
  }

  const lastActivityTs = stats?.lastActivityAt ? new Date(stats.lastActivityAt).getTime() : null;
  const liveState = !lastActivityTs
    ? 'waiting'
    : now - lastActivityTs < LIVE_WINDOW_MS
      ? 'live'
      : 'idle';

  const inboxStatus = {
    live: { className: 'status-pill live', text: 'Live — receiving data' },
    idle: { className: 'status-pill idle', text: 'Idle — no recent activity' },
    waiting: { className: 'status-pill waiting', text: 'Waiting for first booking' },
  }[liveState];

  return (
    <Layout title="Dashboard">
      {/* Salon header + inbox status */}
      <div className="dash-head">
        <div>
          {salon ? (
            <p className="muted" style={{ margin: '0 0 0.25rem' }}>
              {salon.name}
              {salon.slug ? (
                <>
                  {' · '}
                  <code className="mono">{forwardingEmail(salon.slug)}</code>
                </>
              ) : null}
            </p>
          ) : null}
          <span className={inboxStatus.className}>
            <span className="status-dot" aria-hidden="true" />
            {inboxStatus.text}
          </span>
        </div>
        <div className="dash-head-actions">
          {lastUpdated ? (
            <span className="muted small">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          ) : null}
          <button className="btn btn-outline" onClick={loadData} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <div className="card error-card">Error: {error}</div> : null}

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">{stats ? stats.totalBookings : '—'}</span>
          <span className="stat-label">Total Bookings</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats ? stats.messagesSent : '—'}</span>
          <span className="stat-label">Messages Sent</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {stats && stats.successRate !== null && stats.successRate !== undefined
              ? `${stats.successRate}%`
              : '—'}
          </span>
          <span className="stat-label">Success Rate</span>
          {stats ? (
            <span className="stat-sub muted small">
              {stats.messagesSent} sent · {stats.messagesFailed} failed
            </span>
          ) : null}
        </div>
      </div>

      {salon ? (
        <ConnectionPanel salon={salon} userId={userId} onUpdated={setSalon} />
      ) : null}

      {/* Recent activity */}
      <section className="card">
        <h2 className="section-title">Recent Activity</h2>
        {activity.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No activity yet. New bookings and WhatsApp messages will appear here.
          </p>
        ) : (
          <ul className="activity-list">
            {activity.map((item) => {
              const meta = TYPE_META[item.type] || TYPE_META.booking;
              return (
                <li key={item.id} className="activity-item">
                  <span className="activity-icon" aria-hidden="true">
                    {meta.icon}
                  </span>
                  <div className="activity-body">
                    <span className="activity-title">{item.title}</span>
                    {item.detail ? (
                      <span className="activity-detail muted">{item.detail}</span>
                    ) : null}
                  </div>
                  <span className="activity-time muted small">
                    {timeAgo(item.created_at, now)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </Layout>
  );
}
