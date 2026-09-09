import express, { Application } from 'express';
import cors from 'cors';
import { config } from './config';
import { authenticateApiKey } from './auth';
import routes from './routes';

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Apply authentication to all API routes
app.use('/v1', authenticateApiKey);

// Routes
app.use('/', routes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: {
      message: 'Internal server error',
      type: 'server_error',
      code: 'internal_error'
    }
  });
});

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 OpenAI v1 Compatible API Server running on port ${PORT}`);
  console.log(`📝 Using model: ${config.model}`);
  console.log(`🔑 Configured ${config.geminiApiKeys.length} Gemini API keys for rotation`);
  console.log(`📁 Logging to: ${config.logDir}`);
  console.log(`🔒 API requires password authentication`);
});

export default app;
