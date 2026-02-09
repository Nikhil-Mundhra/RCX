const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

const app = express();
app.use(cors());
app.use(express.json());

// Simple in-memory stores for scaffold
const properties = [
  { id: 1, name: 'Oceanview Condos', location: 'Coastline', price: 1200000 },
  { id: 2, name: 'Downtown Loft', location: 'City Center', price: 800000 }
];

const markets = [
  { id: 'RCX', name: 'Property Stock Exchange', status: 'open' }
];

// Portfolios (demo data) — each portfolio contains holdings (propertyId, weight)
const portfolios = [
  { id: 1, name: 'Income Focused', holdings: [{ propertyId: 1, weight: 0.7 }, { propertyId: 2, weight: 0.3 }] },
  { id: 2, name: 'Growth Focused', holdings: [{ propertyId: 1, weight: 0.3 }, { propertyId: 2, weight: 0.7 }] }
];

// Simple in-memory user store for demo
const users = [];

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Generate valuation history (monthly) for demo
function generateHistory(base, months = 24, volatility = 0.02) {
  const series = [];
  const now = new Date();
  let value = base;
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    // small drift + noise
    const drift = 1 + (Math.random() - 0.4) * volatility;
    value = Math.max(1000, Math.round(value * drift));
    series.push({ date: d.toISOString().slice(0, 10), value });
  }
  return series;
}

// Attach history per property for demo
const propertyHistories = {
  1: generateHistory(1200000, 36, 0.03),
  2: generateHistory(800000, 36, 0.04)
};

// Compute portfolio history (sum of holdings weighted)
function portfolioHistory(portfolioId) {
  const p = portfolios.find(x => x.id === Number(portfolioId));
  if (!p) return [];
  const months = propertyHistories[p.holdings[0].propertyId].length;
  const series = [];
  for (let i = 0; i < months; i++) {
    const date = propertyHistories[p.holdings[0].propertyId][i].date;
    let value = 0;
    p.holdings.forEach(h => {
      const hist = propertyHistories[h.propertyId];
      value += (hist[i]?.value || 0) * h.weight;
    });
    series.push({ date, value: Math.round(value) });
  }
  return series;
}

// Simple metrics computation for a portfolio
function computeMetrics(portfolioId) {
  const hist = portfolioHistory(portfolioId);
  if (!hist.length) return {};
  const start = hist[0].value;
  const end = hist[hist.length - 1].value;
  const totalReturn = ((end - start) / start) * 100;
  const monthlyReturns = [];
  for (let i = 1; i < hist.length; i++) {
    monthlyReturns.push((hist[i].value - hist[i - 1].value) / hist[i - 1].value);
  }
  const avgMonthly = monthlyReturns.reduce((a, b) => a + b, 0) / monthlyReturns.length;
  const annualized = ((1 + avgMonthly) ** 12 - 1) * 100;
  // Mock cap rate and occupancy (demo values)
  const capRate = 0.045 + (Math.random() - 0.5) * 0.01; // ~4-5%
  const occupancy = 0.9 + (Math.random() - 0.5) * 0.05; // ~88-92%

  return {
    portfolioId: Number(portfolioId),
    totalValue: end,
    totalReturn: Number(totalReturn.toFixed(2)),
    annualizedReturn: Number(annualized.toFixed(2)),
    capRate: Number((capRate * 100).toFixed(2)),
    occupancy: Number((occupancy * 100).toFixed(2))
  };
}

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/properties', (req, res) => {
  res.json(properties);
});

app.get('/api/portfolios', (req, res) => {
  res.json(portfolios);
});

app.get('/api/portfolios/:id', (req, res) => {
  const p = portfolios.find(x => x.id === Number(req.params.id));
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

app.get('/api/portfolios/:id/history', (req, res) => {
  const hist = portfolioHistory(req.params.id);
  res.json(hist);
});

app.get('/api/metrics/comparison', (req, res) => {
  // Query ?ids=1,2
  const ids = (req.query.ids || '').split(',').map(x => x).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: 'Provide ids query parameter' });
  const metrics = ids.map(id => computeMetrics(id));
  res.json(metrics);
});

app.get('/api/benchmark', (req, res) => {
  // Return a simple benchmark time series for comparison
  const months = 36;
  const start = 1000000;
  const series = generateHistory(start, months, 0.025).map(s => ({ date: s.date, value: s.value }));
  res.json(series);
});

// --- Auth endpoints (demo only) ---
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (users.find(u => u.email === email)) return res.status(400).json({ error: 'User exists' });
  const hash = await bcrypt.hash(password, 10);
  const id = users.length ? users[users.length - 1].id + 1 : 1;
  const user = { id, name: name || '', email, passwordHash: hash };
  users.push(user);
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(400).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.post('/api/properties', (req, res) => {
  const { name, location, price } = req.body;
  const id = properties.length ? properties[properties.length - 1].id + 1 : 1;
  const prop = { id, name, location, price };
  properties.push(prop);
  res.status(201).json(prop);
});

app.get('/api/markets', (req, res) => res.json(markets));

// Serve static client at root and also under /client for compatibility
const clientPath = path.join(__dirname, 'client');
app.use('/client', express.static(clientPath));
app.use(express.static(clientPath));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
