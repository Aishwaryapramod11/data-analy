import { useState, useEffect, useCallback } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { 
  Eye, Users, Clock, ArrowUpRight, ArrowDownRight, 
  LogOut, RefreshCw, Database, Trash2, Globe, Laptop, Smartphone, Tablet
} from 'lucide-react';

const API_BASE_URL = window.location.port === '5173' || window.location.port === '5174'
  ? 'http://localhost:5050/api'
  : '/api';

const COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

export default function Dashboard({ token, user, onLogout, refreshTrigger }) {
  const [range, setRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [data, setData] = useState({
    metrics: {
      pageViews: { value: 0, trend: 0 },
      uniqueVisitors: { value: 0, trend: 0 },
      avgDuration: { value: 0, trend: 0 },
      bounceRate: { value: 0, trend: 0 }
    },
    chartData: [],
    topPages: [],
    referrers: [],
    devices: [],
    os: [],
    countries: [],
    recentLogs: []
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/overview?range=${range}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);
      } else if (res.status === 403 || res.status === 401) {
        onLogout();
      }
    } catch (error) {
      console.error('Error fetching analytics overview:', error);
    } finally {
      setLoading(false);
    }
  }, [range, token, onLogout]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // Seed 30 days of mock data
  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/seed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  // Clear data
  const handleClearData = async () => {
    if (!window.confirm('Are you sure you want to clear all analytics records?')) return;
    setClearing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/analytics/clear`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        await fetchData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setClearing(false);
    }
  };

  // Formatting utilities
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const formatTrend = (trend) => {
    if (trend === 0) return '0%';
    const sign = trend > 0 ? '+' : '';
    return `${sign}${trend}%`;
  };

  // Pre-process device breakdown data for Recharts Pie Chart
  const pieData = data.devices.map(item => ({
    name: item.name,
    value: item.count
  }));

  // Simple mapping of country code to flag emoji
  const getFlagEmoji = (countryCode) => {
    if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
      return '🌐';
    }
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char =>  127397 + char.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return countryCode;
    }
  };

  const hasData = data.metrics.pageViews.value > 0;

  return (
    <div className="dashboard-container">
      {/* Top Navbar */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo-badge">
            <span className="logo-spark">✨</span>
            <span className="logo-text">PulseAnalytics</span>
          </div>
          <span className="header-divider">/</span>
          <span className="project-title">Demo Workspace</span>
        </div>

        <div className="header-right">
          <div className="user-profile">
            <div className="avatar">{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</div>
            <span className="user-name">{user.name || 'User'}</span>
          </div>
          <button type="button" onClick={onLogout} className="btn-logout" title="Sign Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Control Panel */}
      <section className="control-bar">
        {/* Date Filters */}
        <div className="range-selector">
          <button
            type="button"
            className={`range-btn ${range === '24h' ? 'active' : ''}`}
            onClick={() => setRange('24h')}
          >
            24 Hours
          </button>
          <button
            type="button"
            className={`range-btn ${range === '7d' ? 'active' : ''}`}
            onClick={() => setRange('7d')}
          >
            Last 7 Days
          </button>
          <button
            type="button"
            className={`range-btn ${range === '30d' ? 'active' : ''}`}
            onClick={() => setRange('30d')}
          >
            Last 30 Days
          </button>
        </div>

        {/* Action Controls */}
        <div className="action-buttons">
          <button 
            type="button"
            onClick={fetchData} 
            className="btn-action icon-only" 
            disabled={loading}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>

          <button 
            type="button"
            onClick={handleSeedData} 
            className="btn-action btn-seed" 
            disabled={seeding || loading}
          >
            <Database size={16} />
            <span>{seeding ? 'Generating...' : 'Seed Mock Data'}</span>
          </button>

          {hasData && (
            <button 
              type="button"
              onClick={handleClearData} 
              className="btn-action btn-danger" 
              disabled={clearing || loading}
            >
              <Trash2 size={16} />
              <span>{clearing ? 'Clearing...' : 'Clear Data'}</span>
            </button>
          )}
        </div>
      </section>

      {/* Seeding Alert for New DB */}
      {!hasData && !loading && (
        <section className="empty-state-banner">
          <div className="banner-icon">🚀</div>
          <div className="banner-content">
            <h3>Welcome to your Analytics Dashboard!</h3>
            <p>
              The database is currently empty. Click the <strong>Seed Mock Data</strong> button to inject 30 days of highly realistic visitor sessions, referrers, page paths, and devices, so you can explore the dashboard charts immediately!
            </p>
            <button type="button" onClick={handleSeedData} className="banner-btn" disabled={seeding}>
              {seeding ? 'Generating Session Data...' : 'Generate Simulation Data'}
            </button>
          </div>
        </section>
      )}

      {/* Statistics Cards Grid */}
      <section className="metrics-grid">
        {/* Page Views */}
        <div className="metric-card">
          <div className="card-header">
            <span className="card-title">Total Page Views</span>
            <div className="card-icon views"><Eye size={18} /></div>
          </div>
          <div className="card-body">
            <h2>{data.metrics.pageViews.value.toLocaleString()}</h2>
            <div className={`card-trend ${data.metrics.pageViews.trend >= 0 ? 'up' : 'down'}`}>
              {data.metrics.pageViews.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{formatTrend(data.metrics.pageViews.trend)}</span>
              <span className="trend-label">vs prev period</span>
            </div>
          </div>
        </div>

        {/* Unique Visitors */}
        <div className="metric-card">
          <div className="card-header">
            <span className="card-title">Unique Visitors</span>
            <div className="card-icon visitors"><Users size={18} /></div>
          </div>
          <div className="card-body">
            <h2>{data.metrics.uniqueVisitors.value.toLocaleString()}</h2>
            <div className={`card-trend ${data.metrics.uniqueVisitors.trend >= 0 ? 'up' : 'down'}`}>
              {data.metrics.uniqueVisitors.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{formatTrend(data.metrics.uniqueVisitors.trend)}</span>
              <span className="trend-label">vs prev period</span>
            </div>
          </div>
        </div>

        {/* Avg Duration */}
        <div className="metric-card">
          <div className="card-header">
            <span className="card-title">Avg. Session Duration</span>
            <div className="card-icon duration"><Clock size={18} /></div>
          </div>
          <div className="card-body">
            <h2>{formatDuration(data.metrics.avgDuration.value)}</h2>
            <div className={`card-trend ${data.metrics.avgDuration.trend >= 0 ? 'up' : 'down'}`}>
              {data.metrics.avgDuration.trend >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              <span>{formatTrend(data.metrics.avgDuration.trend)}</span>
              <span className="trend-label">vs prev period</span>
            </div>
          </div>
        </div>

        {/* Bounce Rate */}
        <div className="metric-card">
          <div className="card-header">
            <span className="card-title">Bounce Rate</span>
            <div className="card-icon bounce"><ArrowUpRight size={18} /></div>
          </div>
          <div className="card-body">
            <h2>{data.metrics.bounceRate.value}%</h2>
            <div className={`card-trend ${data.metrics.bounceRate.trend >= 0 ? 'up' : 'down'}`}>
              {/* Note: In DB overview, we negated trend so positive is positive improvement (lower bounce rate) */}
              {data.metrics.bounceRate.trend >= 0 ? <ArrowDownRight size={14} className="positive-down" /> : <ArrowUpRight size={14} className="negative-up" />}
              <span>{formatTrend(Math.abs(data.metrics.bounceRate.trend))}</span>
              <span className="trend-label">{data.metrics.bounceRate.trend >= 0 ? 'reduction' : 'increase'}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Charts & Breakdown Panel */}
      <div className="dashboard-grid">
        {/* Main Timeline Chart */}
        <div className="chart-card span-two-thirds">
          <div className="chart-header">
            <h3>Traffic Overview</h3>
            <p>Page views and unique visitors tracked over the selected time range</p>
          </div>
          <div className="chart-wrapper">
            {hasData ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={data.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01}/>
                    </linearGradient>
                    <linearGradient id="colorVisitors" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} tickLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border)', 
                      color: 'var(--text-main)', 
                      borderRadius: '8px',
                      boxShadow: 'var(--shadow-medium)'
                    }} 
                  />
                  <Area type="monotone" dataKey="pageViews" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorViews)" name="Page Views" />
                  <Area type="monotone" dataKey="uniqueVisitors" stroke="#06b6d4" strokeWidth={2} fillOpacity={1} fill="url(#colorVisitors)" name="Unique Visitors" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-placeholder">
                <span className="spinner-placeholder"></span>
                <p>Waiting for data seeding...</p>
              </div>
            )}
          </div>
        </div>

        {/* Device Breakdown (Donut Chart) */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Device Breakdown</h3>
            <p>Traffic split by client devices</p>
          </div>
          <div className="chart-wrapper flex-center">
            {hasData ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'var(--bg-card)', 
                      borderColor: 'var(--border)', 
                      color: 'var(--text-main)',
                      borderRadius: '8px' 
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle" 
                    iconSize={8}
                    formatter={(value, entry) => {
                      const item = pieData.find(d => d.name === value);
                      const total = pieData.reduce((a, b) => a + b.value, 0);
                      const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
                      return <span style={{ color: 'var(--text-main)', fontSize: '13px' }}>{value} ({pct}%)</span>;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="chart-placeholder">
                <p>No device data</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breakdown Lists Grid */}
      <section className="breakdowns-section">
        {/* Top Pages */}
        <div className="breakdown-card">
          <div className="card-header-bar">
            <h3>Top Pages Visited</h3>
          </div>
          <div className="breakdown-list">
            {hasData ? (
              data.topPages.map((page, i) => {
                const maxCount = data.topPages[0]?.count || 1;
                const pct = (page.count / maxCount) * 100;
                return (
                  <div key={page.name} className="breakdown-item">
                    <div className="item-label-row">
                      <span className="item-path">{page.name}</span>
                      <span className="item-count">{page.count.toLocaleString()} views</span>
                    </div>
                    <div className="progress-bg">
                      <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: COLORS[0] }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="no-data-msg">No path records available</p>
            )}
          </div>
        </div>

        {/* Top Referrers */}
        <div className="breakdown-card">
          <div className="card-header-bar">
            <h3>Traffic Referrals</h3>
          </div>
          <div className="breakdown-list">
            {hasData ? (
              data.referrers.map((ref, i) => {
                const maxCount = data.referrers[0]?.count || 1;
                const pct = (ref.count / maxCount) * 100;
                return (
                  <div key={ref.name} className="breakdown-item">
                    <div className="item-label-row">
                      <span className="item-path">{ref.name}</span>
                      <span className="item-count">{ref.count.toLocaleString()} hits</span>
                    </div>
                    <div className="progress-bg">
                      <div className="progress-bar" style={{ width: `${pct}%`, backgroundColor: COLORS[1] }}></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="no-data-msg">No referral channels recorded</p>
            )}
          </div>
        </div>

        {/* Locations and OS */}
        <div className="breakdown-card">
          <div className="card-header-bar">
            <h3>Geographic & System Split</h3>
          </div>
          <div className="split-columns">
            {/* Countries List */}
            <div className="split-column">
              <h4>Countries</h4>
              <div className="list-compact">
                {hasData ? (
                  data.countries.slice(0, 5).map(c => (
                    <div key={c.name} className="compact-item">
                      <span className="compact-item-name">
                        <span className="flag-icon">{getFlagEmoji(c.name)}</span>
                        <span>{c.name}</span>
                      </span>
                      <span className="compact-item-val">{c.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-data-msg">No location records</p>
                )}
              </div>
            </div>

            {/* OS List */}
            <div className="split-column">
              <h4>Operating Systems</h4>
              <div className="list-compact">
                {hasData ? (
                  data.os.slice(0, 5).map(osItem => (
                    <div key={osItem.name} className="compact-item">
                      <span className="compact-item-name">{osItem.name}</span>
                      <span className="compact-item-val">{osItem.count}</span>
                    </div>
                  ))
                ) : (
                  <p className="no-data-msg">No OS records</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Event Log Feed */}
      <section className="live-feed-section">
        <div className="live-header">
          <div className="live-title">
            <span className="live-indicator pulse"></span>
            <h3>Real-time Activity Feed</h3>
          </div>
          <span className="live-subtitle">Showing latest 15 visitor events logged</span>
        </div>

        <div className="table-wrapper">
          {hasData ? (
            <table className="feed-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Page Path</th>
                  <th>Referrer</th>
                  <th>Location</th>
                  <th>Browser & OS</th>
                  <th>Device</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {data.recentLogs.map((log) => (
                  <tr key={log.id} className="feed-row">
                    <td className="col-time">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td className="col-path">
                      <code>{log.pageUrl}</code>
                    </td>
                    <td className="col-referrer">
                      <span className={`ref-badge ${log.referrer.toLowerCase().replace(/\s+/g, '')}`}>
                        {log.referrer}
                      </span>
                    </td>
                    <td className="col-country">
                      <span className="flag-icon">{getFlagEmoji(log.country)}</span>
                      <span>{log.country}</span>
                    </td>
                    <td className="col-system">
                      {log.browser} / {log.os}
                    </td>
                    <td className="col-device">
                      <span className="device-badge">
                        {log.device === 'Mobile' && <Smartphone size={12} />}
                        {log.device === 'Tablet' && <Tablet size={12} />}
                        {log.device === 'Desktop' && <Laptop size={12} />}
                        <span>{log.device}</span>
                      </span>
                    </td>
                    <td className="col-duration">
                      {log.duration > 0 ? formatDuration(log.duration) : <span className="text-muted">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-table-placeholder">
              <p>No activity records logged in the database yet.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
