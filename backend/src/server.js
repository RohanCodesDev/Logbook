import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';

import healthRouter from './routes/health.js';
import logsRouter from './routes/logs.js';
import projectsRouter from './routes/projects.js';
import sectionsRouter from './routes/sections.js';
import fieldsRouter from './routes/fields.js';
import recordsRouter from './routes/records.js';
import dashboardRouter from './routes/dashboard.js';
import reportsRouter from './routes/reports.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { runMigrations } from './db/migrate.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// API Routes
app.use('/api/health',    healthRouter);
app.use('/api/logs',      logsRouter);
app.use('/api/projects',  projectsRouter);
app.use('/api/sections',  sectionsRouter);
app.use('/api/fields',    fieldsRouter);
app.use('/api/records',   recordsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports',   reportsRouter);

// 404 & Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start: run DB migrations, then listen
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Running on http://localhost:${PORT}`);
      console.log(`[Server] Health:   http://localhost:${PORT}/api/health`);
      console.log(`[Server] Projects: http://localhost:${PORT}/api/projects`);
    });
  })
  .catch((err) => {
    console.error('[Server] Failed to start — DB migration error:', err.message);
    process.exit(1);
  });
