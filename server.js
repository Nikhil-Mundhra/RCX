const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/properties', (req, res) => {
  res.json(properties);
});

app.post('/api/properties', (req, res) => {
  const { name, location, price } = req.body;
  const id = properties.length ? properties[properties.length - 1].id + 1 : 1;
  const prop = { id, name, location, price };
  properties.push(prop);
  res.status(201).json(prop);
});

app.get('/api/markets', (req, res) => res.json(markets));

// Serve static client
const clientPath = path.join(__dirname, 'client');
app.use(express.static(clientPath));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
