import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import dns from 'dns';

import connectDB from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware, metricsHandler } from './middleware/metrics.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workspaceRoutes from './routes/workspaces.js';
import teamRoutes from './routes/teams.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import savedFilterRoutes from './routes/savedFilters.js';   // Feature 6
import workflowRoutes from './routes/workflows.js';         // Feature 7

// Fallback DNS servers for environments with restricted DNS resolution
try {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
} catch {
  // Ignore DNS override errors in environments that do not support custom servers
}

const app = express();

// ── Metrics Middleware ─────────────────────────────────────────────────────────
app.use(metricsMiddleware);

// ── Security ───────────────────────────────────────────────────────────────────
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health' || req.path === '/metrics',
});
app.use(limiter);

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ── Body / cookies ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Logging ────────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check & Metrics ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'connecting';
  res.json({
    success: true,
    message: 'TaskFlow API is healthy',
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

app.get('/metrics', metricsHandler);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/workspaces/:workspaceId/teams', teamRoutes);
app.use('/api/workspaces/:workspaceId/projects', projectRoutes);
app.use('/api/workspaces/:workspaceId/tasks', taskRoutes);
app.use('/api/workspaces/:workspaceId/saved-filters', savedFilterRoutes);  // Feature 6
app.use('/api/workspaces/:workspaceId/workflows', workflowRoutes);          // Feature 7

// ── 404 ────────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// ── Error handler ──────────────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 TaskFlow API running on http://${HOST}:${PORT}`);
});

connectDB();

export default app;
