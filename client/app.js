async function fetchJSON(path) {
  const res = await fetch(path);
  return res.json();
}

function renderMarkets(list) {
  const el = document.getElementById('markets');
  el.innerHTML = '';
  list.forEach(m => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `
      <h3 style="margin-top: 0;">${m.name}</h3>
      <p class="muted" style="margin: 8px 0;">Status: <strong>${m.status}</strong></p>
    `;
    el.appendChild(d);
  });
}

function renderProperties(list) {
  const el = document.getElementById('properties');
  el.innerHTML = '';
  list.forEach(p => {
    const d = document.createElement('div');
    d.className = 'card property-card';
    d.innerHTML = `
      <h3 style="margin-top: 0;">${p.name}</h3>
      <p class="property-meta">${p.location}</p>
      <p class="property-price">$${p.price.toLocaleString()}</p>
    `;
    el.appendChild(d);
  });
}

async function load() {
  const markets = await fetchJSON('/api/markets');
  renderMarkets(markets);
  const props = await fetchJSON('/api/properties');
  renderProperties(props);
}

document.getElementById('addForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value;
  const location = document.getElementById('location').value;
  const price = Number(document.getElementById('price').value);
  const res = await fetch('/api/properties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, location, price })
  });
  if (res.ok) {
    document.getElementById('name').value = '';
    document.getElementById('location').value = '';
    document.getElementById('price').value = '';
    load();
  }
});

load();
