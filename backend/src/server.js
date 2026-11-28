import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import pool from './db/index.js';
import healthRouter from './routes/health.js';
import logsRouter from './routes/logs.js';
import projectsRouter from './routes/projects.js';
import sectionsRouter from './routes/sections.js';
import fieldsRouter from './routes/fields.js';
import recordsRouter from './routes/records.js';
import dashboardRouter from './routes/dashboard.js';
import reportsRouter from './routes/reports.js';
import crewRouter from './routes/crew.js';
import agreementsRouter from './routes/agreements.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { runMigrations } from './db/migrate.js';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const isProd = process.env.NODE_ENV === 'production';

// Trust Render's reverse proxy
app.set('trust proxy', 1);

// CORS: if CORS_ORIGIN is configured (comma-separated URLs), enforce it; otherwise allow all origins
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
  : null;

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, callback) => {
          if (!origin) return callback(null, true);
          const clean = origin.replace(/\/+$/, '');
          if (allowedOrigins.includes('*') || allowedOrigins.includes(clean)) {
            return callback(null, true);
          }
          return callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      : true,
    credentials: true,
  })
);

app.use(express.json({ limit: '15mb' }));
app.use(morgan(isProd ? 'combined' : 'dev'));

// Root endpoint for Render uptime checks & service discovery
app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'Logbook Backend API',
    health: '/api/health',
  });
});

// API Routes
app.use('/api/health',    healthRouter);
app.use('/api/logs',      logsRouter);
app.use('/api/projects',  projectsRouter);
app.use('/api/sections',  sectionsRouter);
app.use('/api/fields',    fieldsRouter);
app.use('/api/records',   recordsRouter);
app.use('/api/dashboard',  dashboardRouter);
app.use('/api/reports',    reportsRouter);
app.use('/api/crew',       crewRouter);
app.use('/api/agreements', agreementsRouter);

// 404 & Error handling
app.use(notFoundHandler);
app.use(errorHandler);

let server;

// Start: run DB migrations, then listen on 0.0.0.0 for Render
runMigrations()
  .then(() => {
    server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Listening on 0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
      console.log(`[Server] Health check: /api/health`);
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to start — DB migration error:', err.message);
    process.exit(1);
  });

// Graceful shutdown on Render SIGTERM / SIGINT
const shutdown = (signal) => {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
