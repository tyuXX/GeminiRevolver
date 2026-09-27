import fs from 'fs';
import path from 'path';
import { config } from './config';

interface LogEntry {
  timestamp: string;
  requestId: string;
  type: 'request' | 'response' | 'error';
  data: any;
}

class RequestLogger {
  private logDir: string;
  private currentLogFile: string;

  constructor() {
    this.logDir = config.logDir;
    this.ensureLogDirectory();
    this.currentLogFile = this.getLogFileName();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `api-logs-${date}.json`);
  }

  private updateLogFileIfNeeded(): void {
    const newLogFile = this.getLogFileName();
    if (newLogFile !== this.currentLogFile) {
      this.currentLogFile = newLogFile;
    }
  }

  private writeLog(entry: LogEntry): void {
    this.updateLogFileIfNeeded();
    
    const logLine = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.currentLogFile, logLine, 'utf8');
  }

  logRequest(requestId: string, data: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      type: 'request',
      data
    };
    this.writeLog(entry);
  }

  logResponse(requestId: string, data: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      type: 'response',
      data
    };
    this.writeLog(entry);
  }

  logError(requestId: string, error: any): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        ...error
      }
    };
    this.writeLog(entry);
  }

  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const requestLogger = new RequestLogger();
