import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import tracker from './tracker';

const API_BASE_URL = window.location.port === '5173' || window.location.port === '5174'
  ? 'http://localhost:5050/api'
  : '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('analytics_token') || null);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(!!token);
  
  // Navigation tracking simulation
  const [currentDemoPage, setCurrentDemoPage] = useState('/dashboard');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Verify stored token on startup
  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setCheckingAuth(false);
        return;
      }
      try {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          // Token is invalid, reset state
          handleLogout();
        }
      } catch (err) {
        console.error('Auth check failed:', err);
        handleLogout();
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [token]);

  // Start the page tracking on load (passing false so it doesn't track the dashboard site itself)
  useEffect(() => {
    tracker.init(false);
  }, []);

  const handleLogin = (authToken, loggedInUser) => {
    setToken(authToken);
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('analytics_token');
    localStorage.removeItem('analytics_user_name');
    localStorage.removeItem('analytics_user_id');
    setToken(null);
    setUser(null);
  };

  // Simulates navigating to a new page in the tracked client application
  const navigateToDemoPage = (path) => {
    setCurrentDemoPage(path);
    tracker.trackPageview(path);
    // Slight delay to allow server database update to complete before refresh
    setTimeout(() => {
      setRefreshTrigger(prev => prev + 1);
    }, 150);
  };

  if (checkingAuth) {
    return (
      <div className="loading-screen">
        <span className="spinner"></span>
        <p>Verifying session security...</p>
      </div>
    );
  }

  return (
    <>
      {!(token && user) ? (
        <Login onLogin={handleLogin} />
      ) : (
        <div className="app-workspace">
          {/* Tracker Simulation Panel */}
          <div className="tracker-simulator-panel">
            <div className="simulator-label">
              <span className="badge-live">Live</span>
              <span>Test Tracker Site Simulator:</span>
            </div>
            <div className="simulator-links">
              <button 
                type="button"
                className={`sim-link ${currentDemoPage === '/' ? 'active' : ''}`}
                onClick={() => navigateToDemoPage('/')}
              >
                🏠 Home Page
              </button>
              <button 
                type="button"
                className={`sim-link ${currentDemoPage === '/features' ? 'active' : ''}`}
                onClick={() => navigateToDemoPage('/features')}
              >
                ⚡ Features
              </button>
              <button 
                type="button"
                className={`sim-link ${currentDemoPage === '/pricing' ? 'active' : ''}`}
                onClick={() => navigateToDemoPage('/pricing')}
              >
                💎 Pricing
              </button>
              <button 
                type="button"
                className={`sim-link ${currentDemoPage === '/docs' ? 'active' : ''}`}
                onClick={() => navigateToDemoPage('/docs')}
              >
                📚 Documentation
              </button>
              <button 
                type="button"
                className={`sim-link ${currentDemoPage === '/contact' ? 'active' : ''}`}
                onClick={() => navigateToDemoPage('/contact')}
              >
                ✉️ Contact Sales
              </button>
            </div>
            <div className="simulator-help">
              💡 <em>Click any link above! It will automatically log a pageview event using <strong>tracker.js</strong>, showing up instantly on the feed below.</em>
            </div>
          </div>

          {/* Actual Analytics Dashboard */}
          <Dashboard 
            token={token} 
            user={user} 
            onLogout={handleLogout} 
            refreshTrigger={refreshTrigger}
          />
        </div>
      )}
    </>
  );
}

export default App;
