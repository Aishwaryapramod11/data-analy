import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op, fn, col } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import { sequelize, User, PageEvent } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


dotenv.config();

const app = express();
const PORT = process.env.PORT || 5050;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-12345';

app.use(cors());
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// --- Auth Routes ---

// Signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// --- Analytics Tracking Route ---

// Public tracking endpoint (CORS enabled, no auth needed)
app.post('/api/analytics/track', async (req, res) => {
  try {
    const { pageUrl, referrer, device, browser, os, country, duration, sessionId, userId } = req.body;

    if (!pageUrl || !sessionId) {
      return res.status(400).json({ error: 'pageUrl and sessionId are required' });
    }

    const event = await PageEvent.create({
      pageUrl,
      referrer: referrer || 'Direct',
      device: device || 'Desktop',
      browser: browser || 'Unknown',
      os: os || 'Unknown',
      country: country || 'Unknown',
      duration: duration || 0,
      sessionId,
      userId: userId || null,
      timestamp: new Date()
    });

    res.status(201).json({ success: true, eventId: event.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Dashboard Queries Route ---

app.get('/api/analytics/overview', authenticateToken, async (req, res) => {
  try {
    const { range } = req.query; // '24h', '7d', '30d' (default: '7d')
    const days = range === '24h' ? 1 : range === '30d' ? 30 : 7;

    const now = new Date();
    const startDate = new Date();
    if (range === '24h') {
      startDate.setHours(now.getHours() - 24);
    } else {
      startDate.setDate(now.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }

    // Previous period for trend calculations
    const prevStartDate = new Date(startDate);
    if (range === '24h') {
      prevStartDate.setHours(prevStartDate.getHours() - 24);
    } else {
      prevStartDate.setDate(prevStartDate.getDate() - days);
    }

    // --- Current Period Queries ---
    const events = await PageEvent.findAll({
      where: {
        timestamp: {
          [Op.gte]: startDate
        }
      },
      order: [['timestamp', 'ASC']]
    });

    // --- Previous Period Queries ---
    const prevEvents = await PageEvent.findAll({
      where: {
        timestamp: {
          [Op.gte]: prevStartDate,
          [Op.lt]: startDate
        }
      }
    });

    // Helper function to calculate aggregate statistics
    const calculateStats = (periodEvents) => {
      const pageViews = periodEvents.length;
      
      const sessionMap = new Map();
      let totalDuration = 0;
      let durationCount = 0;

      periodEvents.forEach(e => {
        // Collect pages per session
        if (!sessionMap.has(e.sessionId)) {
          sessionMap.set(e.sessionId, []);
        }
        sessionMap.get(e.sessionId).push(e);

        if (e.duration > 0) {
          totalDuration += e.duration;
          durationCount++;
        }
      });

      const uniqueVisitors = sessionMap.size;
      const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

      // Bounce rate: % of sessions with exactly 1 page view
      let bounces = 0;
      sessionMap.forEach(pages => {
        if (pages.length === 1) {
          bounces++;
        }
      });
      const bounceRate = uniqueVisitors > 0 ? Math.round((bounces / uniqueVisitors) * 100) : 0;

      return { pageViews, uniqueVisitors, avgDuration, bounceRate };
    };

    const currentStats = calculateStats(events);
    const prevStats = calculateStats(prevEvents);

    // Calculate percentage improvements
    const calcTrend = (curr, prev) => {
      if (!prev) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    const metrics = {
      pageViews: { value: currentStats.pageViews, trend: calcTrend(currentStats.pageViews, prevStats.pageViews) },
      uniqueVisitors: { value: currentStats.uniqueVisitors, trend: calcTrend(currentStats.uniqueVisitors, prevStats.uniqueVisitors) },
      avgDuration: { value: currentStats.avgDuration, trend: calcTrend(currentStats.avgDuration, prevStats.avgDuration) },
      bounceRate: { value: currentStats.bounceRate, trend: -calcTrend(currentStats.bounceRate, prevStats.bounceRate) } // Lower is better
    };

    // --- Chart Formatter ---
    // Group page views & visitors by date / hour
    const chartDataMap = new Map();

    if (range === '24h') {
      // Initialize 24 hours
      for (let i = 23; i >= 0; i--) {
        const d = new Date(now);
        d.setHours(now.getHours() - i);
        const label = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        chartDataMap.set(label, { label, pageViews: 0, uniqueVisitors: new Set() });
      }

      events.forEach(e => {
        const label = new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        if (chartDataMap.has(label)) {
          const item = chartDataMap.get(label);
          item.pageViews++;
          item.uniqueVisitors.add(e.sessionId);
        }
      });
    } else {
      // Initialize days
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
        chartDataMap.set(label, { label, pageViews: 0, uniqueVisitors: new Set() });
      }

      events.forEach(e => {
        const label = new Date(e.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
        if (chartDataMap.has(label)) {
          const item = chartDataMap.get(label);
          item.pageViews++;
          item.uniqueVisitors.add(e.sessionId);
        }
      });
    }

    const chartData = Array.from(chartDataMap.values()).map(item => ({
      label: item.label,
      pageViews: item.pageViews,
      uniqueVisitors: item.uniqueVisitors.size
    }));

    // --- Breakdowns ---
    const getBreakdown = (field) => {
      const counts = {};
      events.forEach(e => {
        const val = e[field] || 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    };

    const topPages = getBreakdown('pageUrl');
    const referrers = getBreakdown('referrer');
    const devices = getBreakdown('device');
    const os = getBreakdown('os');
    const countries = getBreakdown('country');

    // Get 15 most recent events to populate a live list
    const recentLogs = events.slice(-15).reverse().map(e => ({
      id: e.id,
      pageUrl: e.pageUrl,
      referrer: e.referrer,
      device: e.device,
      browser: e.browser,
      os: e.os,
      country: e.country,
      duration: e.duration,
      timestamp: e.timestamp
    }));

    res.json({
      metrics,
      chartData,
      topPages,
      referrers,
      devices,
      os,
      countries,
      recentLogs
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Mock Data Seeding Route ---

app.post('/api/analytics/seed', authenticateToken, async (req, res) => {
  try {
    // Optional: Clear existing events first to prevent bloating
    await PageEvent.destroy({ where: {} });

    const paths = ['/', '/dashboard', '/features', '/pricing', '/docs', '/blog/web-analytics-guide', '/contact'];
    const referrers = ['Direct', 'Google Search', 'GitHub', 'Twitter / X', 'LinkedIn', 'Product Hunt', 'HackerNews'];
    const countries = ['US', 'IN', 'GB', 'DE', 'CA', 'FR', 'JP', 'AU', 'BR', 'SG'];
    
    const devices = [
      { name: 'Desktop', share: 0.65 },
      { name: 'Mobile', share: 0.30 },
      { name: 'Tablet', share: 0.05 }
    ];

    const browsersByDevice = {
      Desktop: ['Chrome', 'Firefox', 'Safari', 'Edge'],
      Mobile: ['Chrome Mobile', 'Safari Mobile', 'Samsung Internet'],
      Tablet: ['Safari Mobile', 'Chrome Mobile']
    };

    const osByDevice = {
      Desktop: ['Windows', 'macOS', 'Linux'],
      Mobile: ['Android', 'iOS'],
      Tablet: ['iOS', 'Android']
    };

    const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const randomChoiceWeighted = (weightedArr) => {
      const r = Math.random();
      let sum = 0;
      for (const item of weightedArr) {
        sum += item.share;
        if (r <= sum) return item.name;
      }
      return weightedArr[0].name;
    };

    const seedEvents = [];
    const daysToSeed = 30;
    const now = new Date();

    for (let day = daysToSeed; day >= 0; day--) {
      const date = new Date(now);
      date.setDate(now.getDate() - day);

      // Generate a dynamic number of visitors. Let's make it look like a growing traffic pattern!
      const trafficMultiplier = 1 + (daysToSeed - day) * 0.03; // ~90% traffic growth over 30 days
      const numSessions = Math.floor((Math.random() * 20 + 10) * trafficMultiplier);

      for (let s = 0; s < numSessions; s++) {
        // Form a session
        const sessionId = `sess_${day}_${s}_${Math.random().toString(36).substr(2, 9)}`;
        const referrer = randomChoice(referrers);
        const country = randomChoice(countries);
        const device = randomChoiceWeighted(devices);
        const browser = randomChoice(browsersByDevice[device]);
        const os = randomChoice(osByDevice[device]);

        // Path navigation count for session (1 = bounce, >1 = deep visit)
        const pagesInSessionCount = Math.floor(Math.random() * 4) + 1; // 1 to 4 pages visited
        
        // Random time for the session start
        const sessionStartHour = Math.floor(Math.random() * 24);
        const sessionStartMinute = Math.floor(Math.random() * 60);
        let sessionTime = new Date(date);
        sessionTime.setHours(sessionStartHour, sessionStartMinute, 0, 0);

        const sessionPaths = [...paths];
        // Always start session at homepage or a landing page
        let currentPath = Math.random() > 0.3 ? '/' : randomChoice(sessionPaths);

        for (let p = 0; p < pagesInSessionCount; p++) {
          // Duration visitor spent on this page (if it's the last page, duration is 0 or low)
          const isLastPage = p === pagesInSessionCount - 1;
          const duration = isLastPage ? 0 : Math.floor(Math.random() * 180) + 10; // 10s to 190s

          seedEvents.push({
            pageUrl: currentPath,
            referrer: p === 0 ? referrer : 'Internal', // Only first hit has external referrer
            device,
            browser,
            os,
            country,
            duration,
            sessionId,
            timestamp: new Date(sessionTime),
          });

          if (isLastPage) break;

          // Increment session time for next page hit
          sessionTime = new Date(sessionTime.getTime() + duration * 1000 + (Math.random() * 5 + 2) * 1000); // duration + 2-7s load/decision gap
          
          // Move to another path
          currentPath = randomChoice(paths.filter(path => path !== currentPath));
        }
      }
    }

    // SQLite bulk insertion
    await PageEvent.bulkCreate(seedEvents);

    res.json({ success: true, count: seedEvents.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear database
app.post('/api/analytics/clear', authenticateToken, async (req, res) => {
  try {
    await PageEvent.destroy({ where: {} });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve static files from the React frontend build folder
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback to index.html for Single Page App routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Sync database and start listening
sequelize.sync().then(() => {
  console.log('Database synchronized');
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database connection error:', err);
});
