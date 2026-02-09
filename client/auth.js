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

// Validation helper
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function showMessage(elementId, message, isError = true) {
  const messageEl = document.getElementById(elementId);
  if (!messageEl) return;
  messageEl.textContent = message;
  messageEl.className = isError ? 'auth-message error' : 'auth-message success';
  messageEl.style.display = 'block';
}

function clearMessage(elementId) {
  const messageEl = document.getElementById(elementId);
  if (messageEl) {
    messageEl.textContent = '';
    messageEl.style.display = 'none';
  }
}

// Signup form
const signupForm = document.getElementById('signupForm');
console.debug('[auth.js] found signupForm?', !!signupForm);
if (signupForm) {
  console.debug('[auth.js] attaching signup event listener');
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage('signupMessage');
    
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Client-side validation
    if (!email) {
      showMessage('signupMessage', 'Email address is required', true);
      return;
    }
    
    if (!validateEmail(email)) {
      showMessage('signupMessage', 'Please enter a valid email address', true);
      return;
    }
    
    if (!password) {
      showMessage('signupMessage', 'Password is required', true);
      return;
    }
    
    if (password.length < 6) {
      showMessage('signupMessage', 'Password must be at least 6 characters long', true);
      return;
    }
    
    try {
      console.debug('[signup] submitting signup for', email);
      const res = await postJSON('/api/auth/register', { name, email, password });
      if (res && res.token) {
        try { localStorage.setItem('rcx_token', res.token); } catch (e) { console.error('Failed to save token', e); }
        try { localStorage.setItem('rcx_welcome', (res.user && (res.user.name || res.user.email)) || email || 'User'); } catch (e) { console.error('Failed to save welcome flag', e); }
        showMessage('signupMessage', `Welcome ${res.user?.name || email}! Redirecting to dashboard...`, false);
        setTimeout(() => {
          window.location.replace('/dashboard.html');
        }, 1500);
        return;
      }
      showMessage('signupMessage', (res && res.error) || 'Registration failed', true);
    } catch (err) {
      console.error('[signup] Signup failed', err);
      showMessage('signupMessage', 'Signup error — please try again', true);
    }
  });
}

// Login form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearMessage('loginMessage');
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    // Client-side validation
    if (!email) {
      showMessage('loginMessage', 'Email address is required', true);
      return;
    }
    
    if (!validateEmail(email)) {
      showMessage('loginMessage', 'Please enter a valid email address', true);
      return;
    }
    
    if (!password) {
      showMessage('loginMessage', 'Password is required', true);
      return;
    }
    
    try {
      console.debug('[login] submitting login for', email);
      const res = await postJSON('/api/auth/login', { email, password });
      if (res && res.token) {
        try { localStorage.setItem('rcx_token', res.token); } catch (e) { console.error('Failed to save token', e); }
        showMessage('loginMessage', `Welcome back, ${res.user?.name || email}! Redirecting...`, false);
        setTimeout(() => {
          window.location.replace('/dashboard.html');
        }, 1500);
        return;
      }
      showMessage('loginMessage', (res && res.error) || 'Login failed', true);
    } catch (err) {
      console.error('[login] Login failed', err);
      showMessage('loginMessage', 'Login error — please try again', true);
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
