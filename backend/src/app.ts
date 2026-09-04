import express, { Application } from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import rbacTestRoutes from './routes/rbac-test.routes';
import instrumentRoutes from './routes/instrument.routes';
import verificationRoutes from './routes/verification.routes';
import toleranceRoutes from './routes/tolerance.routes';
import inspectionRoutes from './routes/inspection.routes';
import riskRoutes from './routes/risk.routes';
import anomalyRoutes from './routes/anomaly.routes';
import regionalRoutes from './routes/regional.routes';
import phase7Routes from './routes/phase7.routes';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';

const app: Application = express();

// CORS Middleware configuration
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: corsOrigin,
    credentials: true
  })
);

// Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/test', rbacTestRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/tolerance-rules', toleranceRoutes);
app.use('/api/inspections', inspectionRoutes);
app.use('/api/risk', riskRoutes);
app.use('/api/anomaly', anomalyRoutes);
app.use('/api/regional', regionalRoutes);
app.use('/api/phase7', phase7Routes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
