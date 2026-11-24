# Logbook Workspace

A fullstack application workspace featuring a **React (Vite + Tailwind CSS)** frontend and a modular **Node.js (Express)** backend.

---

## Project Structure

```
Logbook/
├── frontend/                     # React Single Page Application
│   ├── src/
│   │   ├── components/           # Reusable UI components (Navbar, Footer, etc.)
│   │   ├── pages/                # Page views (Home, Dashboard, About, NotFound)
│   │   ├── services/             # API client services (calls /api)
│   │   ├── App.jsx               # Routes and app layout
│   │   ├── main.jsx              # React DOM entry point
│   │   └── index.css             # Tailwind CSS directives
│   ├── index.html                # Vite HTML shell
│   ├── tailwind.config.js        # Tailwind configuration
│   ├── postcss.config.js         # PostCSS configuration
│   ├── vite.config.js            # Vite configuration with /api proxy to backend
│   └── package.json
│
├── backend/                      # Node.js Express REST API
│   ├── src/
│   │   ├── controllers/          # Business logic handlers
│   │   ├── middleware/           # Error & 404 handling
│   │   ├── routes/               # Express routes (/api/health, /api/logs)
│   │   └── server.js             # Express server entry point
│   ├── .env                      # Environment variables (PORT=5000)
│   └── package.json
│
├── package.json                  # Root workspace convenience scripts
└── README.md
```

---

## Getting Started

### 1. Install Dependencies

You can install dependencies for both apps individually:

**Frontend:**
```bash
cd frontend
npm install
```

**Backend:**
```bash
cd backend
npm install
```

Or from the root directory:
```bash
npm run install:all
```

---

### 2. Running in Development Mode

#### Start the Backend (port 5000):
```bash
cd backend
npm run dev
```
The server will run on `http://localhost:5000` with hot-reload enabled via Nodemon.
- Health Check: `http://localhost:5000/api/health`
- Logs API: `http://localhost:5000/api/logs`

#### Start the Frontend (port 5173):
```bash
cd frontend
npm run dev
```
Open `http://localhost:5173` in your browser.
Any request to `/api/*` is automatically proxied to `http://localhost:5000` by Vite.

---

## Features

- **Frontend:**
  - React 18 with React Router DOM v6
  - Tailwind CSS for modern responsive utility styling
  - Modular `src/pages/` folder structure:
    - `Home.jsx`
    - `Dashboard.jsx` (interactive log manager connected to the backend)
    - `About.jsx` (architecture documentation)
    - `NotFound.jsx` (404 view)
  - Lucide React icons
  - Vite dev server with proxy to backend

- **Backend:**
  - Node.js with native ES Modules
  - Express.js REST API with modular controllers and routes
  - In-memory CRUD for log entries
  - CORS and Morgan logging configured
  - Dotenv environment variable handling
  - Centralized error and 404 handling
