import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const API_BASE_URL = window.location.port === '5173' || window.location.port === '5174'
  ? 'http://localhost:5050/api'
  : '/api';

function App() {
  const [token, setToken] = useState(localStorage.getItem('analytics_token') || null);
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(!!token);
  
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
