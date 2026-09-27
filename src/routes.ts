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
  let apiKey = '';
  let requestedModel = '';
  
  try {
    const body: OpenAIChatRequest = req.body;
    
    // Log the request with full details for debugging
    console.log('[DEBUG] Incoming request:', {
      requestId,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers.authorization ? 'Bearer ***' : 'missing',
        'user-agent': req.headers['user-agent']
      },
      body: body
    });
    
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
    const { client: genAI, apiKey: currentApiKey } = keyRotationManager.createGenerativeAI();
    apiKey = currentApiKey;
    // Always use the configured Gemini model internally, but return the requested model name in response
    requestedModel = body.model || config.model;
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

    // Handle streaming requests
    if (body.stream) {
      console.log('[DEBUG] Streaming response requested');
      
      // Set headers for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Generate streaming response
      const result = await chat.sendMessageStream(lastMessage.parts[0].text);
      let fullContent = '';
      let chunkIndex = 0;
      
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullContent += chunkText;
        
        // Send OpenAI-format chunk
        const chunkResponse = {
          id: `chatcmpl-${requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: requestedModel,
          choices: [{
            index: 0,
            delta: {
              content: chunkText
            },
            finish_reason: null
          }]
        };
        
        res.write(`data: ${JSON.stringify(chunkResponse)}\n\n`);
        chunkIndex++;
      }
      
      // Send final chunk
      const finalChunk = {
        id: `chatcmpl-${requestId}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: requestedModel,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop'
        }]
      };
      
      res.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
      
      console.log('[DEBUG] Streaming response completed:', {
        requestId,
        totalChunks: chunkIndex,
        contentLength: fullContent.length
      });
      
      requestLogger.logResponse(requestId, {
        statusCode: 200,
        response: { streaming: true, chunks: chunkIndex, contentLength: fullContent.length }
      });
      
      return;
    }

    // Generate non-streaming response
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = await result.response;

    // Convert to OpenAI format
    const openaiResponse = convertToOpenAIResponse({ response }, requestedModel, requestId);

    // Log the response
    console.log('[DEBUG] Successful response:', {
      requestId,
      statusCode: 200,
      model: requestedModel,
      contentLength: openaiResponse.choices[0]?.message?.content?.length || 0
    });
    
    requestLogger.logResponse(requestId, {
      statusCode: 200,
      response: openaiResponse
    });

    res.json(openaiResponse);

  } catch (error: any) {
    console.error('[ERROR] Error in chat completion:', {
      requestId,
      error: error.message,
      stack: error.stack,
      name: error.name,
      status: error.status,
      code: error.code
    });
    
    // Log the error
    requestLogger.logError(requestId, {
      error: error.message,
      stack: error.stack
    });

    // Check if it's a rate limit error
    const isRateLimitError = 
      error.status === 429 ||
      error.message?.includes('RATE_LIMIT_EXCEEDED') ||
      error.message?.includes('quota') ||
      error.message?.includes('limit') ||
      error.code === 429 ||
      error.statusCode === 429;
    
    if (isRateLimitError) {
      // Mark the key as rate limited if we have the API key
      if (apiKey) {
        keyRotationManager.markKeyAsRateLimited(apiKey);
      }
      
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
