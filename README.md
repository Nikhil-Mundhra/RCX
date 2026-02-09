# RCX Platform — Node.js Scaffold

This repository contains a minimal scaffold for a Property Stock Exchange platform (RCX) using Node.js and Express with a tiny static frontend.

Quick start

1. Install dependencies:

```bash
cd /path/to/RCX
npm install
```

2. Run the server in development (requires `nodemon`):

```bash
npm run dev
```

3. Or run normally:

```bash
npm start
```

Open http://localhost:3000 in your browser.

Files created

- `server.js` — Express server and API endpoints
- `client/index.html`, `client/app.js` — simple demo frontend
- `package.json` — project manifest

Next steps

- Replace in-memory stores with a database (Postgres/SQLite)
- Add authentication and role-based access
- Implement market/order matching and real-time updates (WebSockets)
