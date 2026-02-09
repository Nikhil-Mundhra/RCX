async function postJSON(path, body) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return res.json();
}

// Signup form
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const res = await postJSON('/api/auth/register', { name, email, password });
    if (res.token) {
      localStorage.setItem('rcx_token', res.token);
      window.location.href = '/dashboard.html';
    } else {
      alert(res.error || 'Registration failed');
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
    const res = await postJSON('/api/auth/login', { email, password });
    if (res.token) {
      localStorage.setItem('rcx_token', res.token);
      window.location.href = '/dashboard.html';
    } else {
      alert(res.error || 'Login failed');
    }
  });
}

// Helper to attach token to fetch
function authFetch(path, opts = {}) {
  const token = localStorage.getItem('rcx_token');
  opts.headers = Object.assign(opts.headers || {}, { 'Authorization': token ? `Bearer ${token}` : '' });
  return fetch(path, opts);
}

// Expose helpers for other pages
window.RCXAuth = { postJSON, authFetch };
