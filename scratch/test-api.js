// Use global fetch

async function test() {
  try {
    const loginRes = await fetch('http://localhost:5050/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com', password: 'password123' }) // Let's check if we can register a test user first
    });
    
    let token = '';
    if (loginRes.ok) {
      const loginData = await loginRes.json();
      token = loginData.token;
      console.log('Login successful');
    } else {
      console.log('Login failed, registering test user...');
      const signupRes = await fetch('http://localhost:5050/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User', email: 'test@example.com', password: 'password123' })
      });
      if (signupRes.ok) {
        const signupData = await signupRes.json();
        token = signupData.token;
        console.log('Signup successful');
      } else {
        const errorText = await signupRes.text();
        console.error('Signup failed:', errorText);
        return;
      }
    }

    // Call Seed
    console.log('Triggering data seeding...');
    const seedRes = await fetch('http://localhost:5050/api/analytics/seed', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const seedData = await seedRes.json();
    console.log('Seed response:', seedData);

    // Call Overview
    console.log('Fetching analytics overview...');
    const overviewRes = await fetch('http://localhost:5050/api/analytics/overview?range=7d', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const overviewData = await overviewRes.json();
    console.log('Overview metrics:', overviewData.metrics);
    console.log('Chart data sample:', overviewData.chartData.slice(-3));
    console.log('Top pages:', overviewData.topPages);
    console.log('Recent logs count:', overviewData.recentLogs.length);
  } catch (err) {
    console.error('API Error:', err);
  }
}

test();
