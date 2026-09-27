import dotenv from 'dotenv';

dotenv.config();

export const config = {
  apiPassword: process.env.API_PASSWORD,
  geminiApiKeys: (process.env.GEMINI_API_KEYS || '').split(',').filter(key => key.trim()),
  port: parseInt(process.env.PORT || '3000', 10),
  logDir: process.env.LOG_DIR || './logs',
  model: 'gemini-flash-lite-latest',
  rateLimitDurationMs: parseInt(process.env.RATE_LIMIT_DURATION_MS || '60000', 10)
};

if (!config.apiPassword) {
  throw new Error('API_PASSWORD is required. Please set it in .env file');
}

if (config.geminiApiKeys.length === 0) {
  throw new Error('No Gemini API keys configured. Please set GEMINI_API_KEYS in .env file');
}
