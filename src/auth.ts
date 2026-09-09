import { Request, Response, NextFunction } from 'express';
import { config } from './config';
import { requestLogger } from './logger';

export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    const requestId = requestLogger.generateRequestId();
    requestLogger.logError(requestId, { message: 'Missing Authorization header', path: req.path });
    res.status(401).json({
      error: {
        message: 'Missing Authorization header',
        type: 'invalid_request_error',
        code: 'missing_api_key'
      }
    });
    return;
  }

  // OpenAI format: "Bearer <api_key>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    const requestId = requestLogger.generateRequestId();
    requestLogger.logError(requestId, { message: 'Invalid Authorization format', path: req.path });
    res.status(401).json({
      error: {
        message: 'Invalid Authorization format. Expected: Bearer <api_key>',
        type: 'invalid_request_error',
        code: 'invalid_api_key_format'
      }
    });
    return;
  }

  const providedKey = parts[1];
  
  if (providedKey !== config.apiPassword) {
    const requestId = requestLogger.generateRequestId();
    requestLogger.logError(requestId, { message: 'Invalid API key', path: req.path });
    res.status(401).json({
      error: {
        message: 'Invalid API key',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
    return;
  }

  next();
};
