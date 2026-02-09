async function postJSON(path, body) {
  console.debug('[postJSON] POST', path, 'body keys:', Object.keys(body));
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let json = null;
  try {
    json = await res.json();
  } catch (e) {
    console.error('[postJSON] Failed to parse JSON response for', path, e);
    throw e;
  }
  console.debug('[postJSON] response from', path, json && (json.error ? { error: json.error } : { hasToken: !!json.token }));
  return json;
}

// Helper to attach token to fetch
function authFetch(path, opts = {}) {
  const token = localStorage.getItem('rcx_token');
  console.debug('[authFetch] fetching', path, 'with token?', !!token);
  opts.headers = Object.assign(opts.headers || {}, { 'Authorization': token ? `Bearer ${token}` : '' });
  return fetch(path, opts);
}

// Check if user is logged in and session is valid
async function checkAuth() {
  const token = localStorage.getItem('rcx_token');
  if (!token) {
    console.debug('[checkAuth] no token found');
    return false;
  }
  try {
    console.debug('[checkAuth] verifying token with server');
    const res = await authFetch('/api/auth/verify', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      console.debug('[checkAuth] server verify result', data);
      return data.valid;
    }
  } catch (e) {
    // Token is invalid or expired
    localStorage.removeItem('rcx_token');
  }
  return false;
}

// Redirect to login if not authenticated
async function requireAuth() {
  const isAuth = await checkAuth();
  if (!isAuth) {
    window.location.href = '/client/login.html';
  }
}

// Get current user info
async function getCurrentUser() {
  try {
    const res = await authFetch('/api/user/profile');
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    // User info unavailable
  }
  return null;
}

// Signup form
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
      console.debug('[signup] submitting signup for', email);
      const res = await postJSON('/api/auth/register', { name, email, password });
      if (res && res.token) {
        try { localStorage.setItem('rcx_token', res.token); } catch (e) { console.error('Failed to save token', e); }
        // store a short-lived welcome flag for the dashboard to show a greeting
        try { localStorage.setItem('rcx_welcome', (res.user && (res.user.name || res.user.email)) || email || 'User'); } catch (e) { console.error('Failed to save welcome flag', e); }
        // use replace so back button doesn't return to signup
        window.location.replace('/dashboard.html');
        return;
      }
      alert((res && res.error) || 'Registration failed');
    } catch (err) {
      console.error('[signup] Signup failed', err);
      alert('Signup error — check console');
    }
  });
}

// Login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    try {
      console.debug('[login] submitting login for', email);
      const res = await postJSON('/api/auth/login', { email, password });
      if (res && res.token) {
        try { localStorage.setItem('rcx_token', res.token); } catch (e) { console.error('Failed to save token', e); }
        window.location.replace('/dashboard.html');
        return;
      }
      alert((res && res.error) || 'Login failed');
    } catch (err) {
      console.error('[login] Login failed', err);
      alert('Login error — check console');
    }
  });
}

// Logout function
function logout() {
  localStorage.removeItem('rcx_token');
  window.location.href = '/';
}

// Expose helpers globally
window.RCXAuth = { postJSON, authFetch, checkAuth, requireAuth, getCurrentUser, logout };
