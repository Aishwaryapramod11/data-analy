// Client-side analytics tracker for single-page applications

const API_BASE_URL = window.location.port === '5173' || window.location.port === '5174'
  ? 'http://localhost:5050/api'
  : '/api';

// Generate or retrieve session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
};

// Detect device category based on screen width
const getDevice = () => {
  const width = window.innerWidth;
  if (width < 768) return 'Mobile';
  if (width < 1024) return 'Tablet';
  return 'Desktop';
};

// Parse User-Agent for Browser and OS
const getBrowserAndOS = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let os = 'Unknown';

  // OS detection
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  // Browser detection
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

  // Mobile variants
  if (os === 'iOS' && browser === 'Safari') browser = 'Safari Mobile';
  if (os === 'Android' && browser === 'Chrome') browser = 'Chrome Mobile';

  return { browser, os };
};

// Estimate Country based on timezone and browser locale
const getCountry = () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const locale = navigator.language || navigator.userLanguage || '';
    
    if (locale.endsWith('-US') || tz.includes('America/New_York') || tz.includes('America/Los_Angeles') || tz.includes('America/Chicago')) return 'US';
    if (locale.endsWith('-IN') || tz === 'Asia/Kolkata') return 'IN';
    if (locale.endsWith('-GB') || tz === 'Europe/London') return 'GB';
    if (locale.endsWith('-DE') || tz === 'Europe/Berlin') return 'DE';
    if (locale.endsWith('-CA') || tz.includes('America/Toronto') || tz.includes('America/Vancouver')) return 'CA';
    if (locale.endsWith('-AU') || tz.includes('Australia/')) return 'AU';
    if (locale.endsWith('-FR') || tz === 'Europe/Paris') return 'FR';
    if (locale.endsWith('-JP') || tz === 'Asia/Tokyo') return 'JP';
    if (locale.endsWith('-BR') || tz.includes('America/Sao_Paulo')) return 'BR';
    if (locale.endsWith('-SG') || tz === 'Asia/Singapore') return 'SG';
    
    // Check general locale region
    if (locale.includes('-')) {
      const region = locale.split('-')[1].toUpperCase();
      if (region.length === 2) return region;
    }
  } catch (e) {
    // Ignore timezone detection errors
  }
  return 'US'; // Default fallback
};

let currentPath = window.location.pathname;
let pageStartTime = Date.now();
let lastReferrer = document.referrer || 'Direct';

// Clean referrer URL to extract hostname
const formatReferrer = (ref) => {
  if (!ref || ref === 'Direct') return 'Direct';
  try {
    const url = new URL(ref);
    if (url.hostname === window.location.hostname) return 'Internal';
    // Clean search engines and social networks
    if (url.hostname.includes('google')) return 'Google Search';
    if (url.hostname.includes('github')) return 'GitHub';
    if (url.hostname.includes('t.co') || url.hostname.includes('twitter') || url.hostname.includes('x.com')) return 'Twitter / X';
    if (url.hostname.includes('linkedin')) return 'LinkedIn';
    if (url.hostname.includes('ycombinator') || url.hostname.includes('news.ycombinator')) return 'HackerNews';
    if (url.hostname.includes('producthunt')) return 'Product Hunt';
    return url.hostname;
  } catch (e) {
    return ref;
  }
};

const sendTrackEvent = async (path, referrer, duration = 0) => {
  const { browser, os } = getBrowserAndOS();
  const payload = {
    pageUrl: path,
    referrer: formatReferrer(referrer),
    device: getDevice(),
    browser,
    os,
    country: getCountry(),
    duration,
    sessionId: getSessionId(),
    userId: localStorage.getItem('analytics_user_id') ? parseInt(localStorage.getItem('analytics_user_id')) : null
  };

  try {
    // We can use sendBeacon for page unload transitions, otherwise fetch
    if (duration > 0 && navigator.sendBeacon) {
      navigator.sendBeacon(`${API_BASE_URL}/analytics/track`, JSON.stringify(payload));
    } else {
      await fetch(`${API_BASE_URL}/analytics/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    }
  } catch (error) {
    console.error('Failed to send analytics tracking event:', error);
  }
};

// Public tracking tracker API
const tracker = {
  // Track page view transition
  trackPageview: (newPath) => {
    const timeSpent = Math.round((Date.now() - pageStartTime) / 1000);
    
    // Log previous page view duration if it was active
    if (currentPath) {
      sendTrackEvent(currentPath, lastReferrer, timeSpent);
    }
    
    // Set up new page context
    lastReferrer = window.location.href; // Previous page becomes referrer
    currentPath = newPath;
    pageStartTime = Date.now();
    
    // Track new page immediately
    sendTrackEvent(currentPath, lastReferrer, 0);
  },

  // Track initial page load
  init: () => {
    currentPath = window.location.pathname;
    pageStartTime = Date.now();
    lastReferrer = document.referrer || 'Direct';
    
    sendTrackEvent(currentPath, lastReferrer, 0);

    // Track page close or navigation away
    window.addEventListener('beforeunload', () => {
      const duration = Math.round((Date.now() - pageStartTime) / 1000);
      sendTrackEvent(currentPath, lastReferrer, duration);
    });
  }
};

export default tracker;
