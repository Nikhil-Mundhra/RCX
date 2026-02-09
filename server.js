const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/rcx';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const JWT_EXPIRY = '7d'; // Persistent login for 7 days

// MongoDB Connection
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  name: { type: String, required: false },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date },
  watchlist: { type: [Number], default: [] }
});

const User = mongoose.model('User', userSchema);

// Serve static files
app.use(express.static('client'));

// Demo data
const properties = [
  { id: 1, name: 'Oceanview Condos', location: 'Coastline', price: 1200000, symbol: 'OVC', change: 2.5 },
  { id: 2, name: 'Downtown Loft', location: 'City Center', price: 800000, symbol: 'DLT', change: -1.2 },
  { id: 3, name: 'Tech Hub Office', location: 'Silicon Valley', price: 2500000, symbol: 'THO', change: 5.8 },
  { id: 4, name: 'Riverside Apartments', location: 'Waterfront', price: 1500000, symbol: 'RVA', change: 3.2 }
];

const markets = [
  { id: 'RCX', name: 'Property Stock Exchange', status: 'open', volume: '2.3M', trend: 'up' }
];

const portfolios = [
  { id: 1, name: 'Income Focused', holdings: [{ propertyId: 1, weight: 0.7 }, { propertyId: 2, weight: 0.3 }] },
  { id: 2, name: 'Growth Focused', holdings: [{ propertyId: 1, weight: 0.3 }, { propertyId: 2, weight: 0.7 }] },
  { id: 3, name: 'Balanced Portfolio', holdings: [{ propertyId: 1, weight: 0.4 }, { propertyId: 3, weight: 0.6 }] }
];

// Auth Middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Generate valuation history for demo
function generateHistory(base, months = 24, volatility = 0.02) {
  const series = [];
  const now = new Date();
  let value = base;
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const drift = 1 + (Math.random() - 0.4) * volatility;
    value = Math.max(1000, Math.round(value * drift));
    series.push({ date: d.toISOString().slice(0, 10), value });
  }
  return series;
}

const propertyHistories = {
  1: generateHistory(1200000, 36, 0.03),
  2: generateHistory(800000, 36, 0.04),
  3: generateHistory(2500000, 36, 0.035),
  4: generateHistory(1500000, 36, 0.025)
};

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
  const capRate = 0.045 + (Math.random() - 0.5) * 0.01;
  const occupancy = 0.9 + (Math.random() - 0.5) * 0.05;
  return {
    portfolioId,
    totalValue: end,
    totalReturn: totalReturn.toFixed(2),
    annualizedReturn: annualized.toFixed(2),
    capRate: (capRate * 100).toFixed(2),
    occupancy: (occupancy * 100).toFixed(2)
  };
}

// ============ AUTH ROUTES ============

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name: name || 'User', email, password: hashedPassword });
    await user.save();
    console.log('[auth] new user registered:', email, 'id=', user._id.toString());

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: 'Invalid email or password' });

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token (check if session is still valid)
app.post('/api/auth/verify', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ valid: true, user: { id: user._id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(401).json({ error: 'Token verification failed' });
  }
});

// ============ API ROUTES ============

// Get user profile
app.get('/api/user/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Get user watchlist
app.get('/api/user/watchlist', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const watchlistProperties = properties.filter(p => user.watchlist.includes(p.id));
    res.json(watchlistProperties);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// Add to watchlist
app.post('/api/user/watchlist/:propertyId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const propertyId = Number(req.params.propertyId);
    if (!user.watchlist.includes(propertyId)) {
      user.watchlist.push(propertyId);
      await user.save();
    }
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// Remove from watchlist
app.delete('/api/user/watchlist/:propertyId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const propertyId = Number(req.params.propertyId);
    user.watchlist = user.watchlist.filter(id => id !== propertyId);
    await user.save();
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update watchlist' });
  }
});

// Get properties
app.get('/api/properties', (req, res) => {
  res.json(properties);
});

// Add property
app.post('/api/properties', (req, res) => {
  const { name, location, price } = req.body;
  const id = Math.max(...properties.map(p => p.id), 0) + 1;
  const newProperty = { id, name, location, price, symbol: name.slice(0, 3).toUpperCase(), change: (Math.random() - 0.5) * 10 };
  properties.push(newProperty);
  propertyHistories[id] = generateHistory(price, 36, 0.03);
  res.status(201).json(newProperty);
});

// Get markets
app.get('/api/markets', (req, res) => {
  res.json(markets);
});

// Get portfolios
app.get('/api/portfolios', (req, res) => {
  res.json(portfolios);
});

// Get portfolio history
app.get('/api/portfolios/:id/history', (req, res) => {
  const hist = portfolioHistory(req.params.id);
  if (!hist.length) return res.status(404).json({ error: 'Portfolio not found' });
  res.json(hist);
});

// Compare metrics
app.get('/api/metrics/comparison', (req, res) => {
  const ids = (req.query.ids || '').split(',').map(Number);
  const metrics = ids.map(id => computeMetrics(id));
  res.json(metrics);
});

// Get property details with history
app.get('/api/properties/:id', (req, res) => {
  const property = properties.find(p => p.id === Number(req.params.id));
  if (!property) return res.status(404).json({ error: 'Property not found' });
  res.json({
    ...property,
    history: propertyHistories[property.id] || [],
    metrics: computeMetrics(property.id)
  });
});

// Serve routes from routes directory
app.use('/api', require('./routes/properties'));

// Serve static HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'client/index.html')));
app.get('/dashboard.html', (req, res) => res.sendFile(path.join(__dirname, 'client/dashboard.html')));
app.get('/client/login.html', (req, res) => res.sendFile(path.join(__dirname, 'client/login.html')));
app.get('/client/signup.html', (req, res) => res.sendFile(path.join(__dirname, 'client/signup.html')));
app.get('/client/about.html', (req, res) => res.sendFile(path.join(__dirname, 'client/about.html')));
app.get('/client/privacy-policy.html', (req, res) => res.sendFile(path.join(__dirname, 'client/privacy-policy.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
