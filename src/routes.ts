import { Router, Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { keyRotationManager } from './keyRotation';
import { requestLogger } from './logger';
import { config } from './config';
import {
  OpenAIChatRequest,
  OpenAIChatResponse,
  OpenAIModelsResponse
} from './openaiTypes';

const router = Router();

// Convert OpenAI format to Gemini format
function convertToGeminiMessages(messages: any[]): any[] {
  return messages
    .filter(msg => msg.role !== 'system') // Gemini doesn't have system messages
    .map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));
}

// Convert Gemini response to OpenAI format
function convertToOpenAIResponse(geminiResponse: any, model: string, requestId: string): OpenAIChatResponse {
  const content = geminiResponse.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return {
    id: `chatcmpl-${requestId}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: content
        },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: geminiResponse.response?.usageMetadata?.promptTokenCount || 0,
      completion_tokens: geminiResponse.response?.usageMetadata?.candidatesTokenCount || 0,
      total_tokens: geminiResponse.response?.usageMetadata?.totalTokenCount || 0
    }
  };
}

// POST /v1/chat/completions
router.post('/v1/chat/completions', async (req: Request, res: Response) => {
  const requestId = requestLogger.generateRequestId();
  
  try {
    const body: OpenAIChatRequest = req.body;
    
    // Log the request
    requestLogger.logRequest(requestId, {
      path: req.path,
      method: req.method,
      body: body
    });

    // Validate request
    if (!body.messages || !Array.isArray(body.messages)) {
      throw new Error('Invalid or missing messages array');
    }

    // Get Gemini client with rotated key
    const genAI = keyRotationManager.createGenerativeAI();
    const model = genAI.getGenerativeModel({ model: config.model });

    // Convert messages
    const geminiMessages = convertToGeminiMessages(body.messages);
    
    // Start chat
    const chat = model.startChat({
      history: geminiMessages.slice(0, -1),
      generationConfig: {
        temperature: body.temperature || 0.7,
        maxOutputTokens: body.max_tokens || 1024,
        topP: body.top_p || 0.8
      }
    });

    // Get the last user message
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      throw new Error('Last message must be from user');
    }

    // Generate response
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = await result.response;

    // Convert to OpenAI format
    const openaiResponse = convertToOpenAIResponse({ response }, body.model, requestId);

    // Log the response
    requestLogger.logResponse(requestId, {
      statusCode: 200,
      response: openaiResponse
    });

    res.json(openaiResponse);

  } catch (error: any) {
    console.error('Error in chat completion:', error);
    
    // Log the error
    requestLogger.logError(requestId, {
      error: error.message,
      stack: error.stack
    });

    // Check if it's a rate limit error
    if (error.message?.includes('RATE_LIMIT_EXCEEDED') || error.status === 429) {
      res.status(429).json({
        error: {
          message: 'Rate limit exceeded. Please try again later.',
          type: 'rate_limit_error',
          code: 'rate_limit_exceeded'
        }
      });
    } else {
      res.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'server_error',
          code: 'internal_error'
        }
      });
    }
  }
});

// GET /v1/models
router.get('/v1/models', (req: Request, res: Response) => {
  const requestId = requestLogger.generateRequestId();
  
  requestLogger.logRequest(requestId, {
    path: req.path,
    method: req.method
  });

  const modelsResponse: OpenAIModelsResponse = {
    object: 'list',
    data: [
      {
        id: config.model,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'google'
      }
    ]
  };

  requestLogger.logResponse(requestId, {
    statusCode: 200,
    response: modelsResponse
  });

  res.json(modelsResponse);
});

// GET /health
router.get('/health', (req: Request, res: Response) => {
  const keyStats = keyRotationManager.getKeyStats();
  res.json({
    status: 'healthy',
    keys: keyStats.map(k => ({
      lastUsed: new Date(k.lastUsed).toISOString(),
      requestCount: k.requestCount,
      rateLimited: k.rateLimitedUntil ? true : false
    }))
  });
});

export default router;
