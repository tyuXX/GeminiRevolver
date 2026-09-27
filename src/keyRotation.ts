import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from './config';

interface KeyUsage {
  key: string;
  lastUsed: number;
  requestCount: number;
  rateLimitedUntil?: number;
}

class KeyRotationManager {
  private keys: KeyUsage[] = [];
  private currentIndex = 0;

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys(): void {
    this.keys = config.geminiApiKeys.map(key => ({
      key: key.trim(),
      lastUsed: 0,
      requestCount: 0
    }));
  }

  private isRateLimited(keyUsage: KeyUsage): boolean {
    if (!keyUsage.rateLimitedUntil) return false;
    return Date.now() < keyUsage.rateLimitedUntil;
  }

  private markRateLimited(keyUsage: KeyUsage, durationMs?: number): void {
    keyUsage.rateLimitedUntil = Date.now() + (durationMs || config.rateLimitDurationMs);
  }

  getNextAvailableKey(): string {
    const now = Date.now();
    let attempts = 0;
    const maxAttempts = this.keys.length * 2;

    while (attempts < maxAttempts) {
      const keyUsage = this.keys[this.currentIndex];
      
      if (!this.isRateLimited(keyUsage)) {
        keyUsage.lastUsed = now;
        keyUsage.requestCount++;
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;
        return keyUsage.key;
      }

      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      attempts++;
    }

    // If all keys are rate limited, return the least recently used one
    const sortedKeys = [...this.keys].sort((a, b) => a.lastUsed - b.lastUsed);
    const selectedKey = sortedKeys[0];
    selectedKey.lastUsed = now;
    selectedKey.requestCount++;
    return selectedKey.key;
  }

  markKeyAsRateLimited(apiKey: string, durationMs?: number): void {
    const keyUsage = this.keys.find(k => k.key === apiKey);
    if (keyUsage) {
      this.markRateLimited(keyUsage, durationMs);
    }
  }

  getKeyStats(): KeyUsage[] {
    return [...this.keys];
  }

  createGenerativeAI(): { client: GoogleGenerativeAI; apiKey: string } {
    const apiKey = this.getNextAvailableKey();
    return {
      client: new GoogleGenerativeAI(apiKey),
      apiKey
    };
  }
}

export const keyRotationManager = new KeyRotationManager();
