import dotenv from 'dotenv';

dotenv.config();

export const config = {
  apiPassword: process.env.API_PASSWORD || 'default_password',
  geminiApiKeys: (process.env.GEMINI_API_KEYS || '').split(',').filter(key => key.trim()),
  port: parseInt(process.env.PORT || '3000', 10),
  logDir: process.env.LOG_DIR || './logs',
  model: 'gemini-flash-lite-latest'
};

if (!config.apiPassword || config.apiPassword === 'default_password') {
  console.warn('WARNING: Using default API password. Please set API_PASSWORD in .env file');
}

if (config.geminiApiKeys.length === 0) {
  throw new Error('No Gemini API keys configured. Please set GEMINI_API_KEYS in .env file');
}
