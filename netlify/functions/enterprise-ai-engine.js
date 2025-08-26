// ENTERPRISE AI SENTIMENT ENGINE - SENIOR DEVELOPER ARCHITECTURE
// Production-grade: Security, Performance, Reliability, Observability, Maintainability
const { createClient } = require('@supabase/supabase-js');
const { Configuration, OpenAIApi } = require('openai');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const CircuitBreaker = require('opossum');

// ENTERPRISE LOGGING & MONITORING
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-sentiment-engine' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// ENTERPRISE CONFIG MANAGEMENT
class ConfigManager {
  constructor() {
    this.validateEnvironment();
  }

  validateEnvironment() {
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY', 
      'OPENAI_API_KEY'
    ];

    for (const env of required) {
      if (!process.env[env]) {
        throw new Error(`Missing required environment variable: ${env}`);
      }
    }
  }

  get openAIKey() {
    return process.env.OPENAI_API_KEY;
  }

  get supabaseConfig() {
    return {
      url: process.env.VITE_SUPABASE_URL,
      key: process.env.VITE_SUPABASE_ANON_KEY
    };
  }

  get aiModel() {
    return {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      maxTokens: 500,
      cacheEnable: true,
      cacheTTLHours: 168,
      costPer1kTokens: 0.0001
    };
  }

  get rateLimits() {
    return {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // requests per window
      standardHeaders: true,
      legacyHeaders: false
    };
  }
}

// ENTERPRISE INPUT VALIDATION & SANITIZATION
class InputValidator {
  static validateSentimentRequest(body) {
    const errors = [];

    if (!body.text || typeof body.text !== 'string') {
      errors.push('Text is required and must be a string');
    } else {
      // Sanitize and validate text
      const sanitized = validator.escape(body.text.trim());
      if (sanitized.length === 0) {
        errors.push('Text cannot be empty after sanitization');
      }
      if (sanitized.length > 10000) {
        errors.push('Text exceeds maximum length of 10,000 characters');
      }
      body.text = sanitized;
    }

    if (body.context && !validator.isAlphanumeric(body.context.replace(/[_-]/g, ''))) {
      errors.push('Context must contain only alphanumeric characters, hyphens, and underscores');
    }

    if (body.organization_id && !validator.isUUID(body.organization_id)) {
      errors.push('Organization ID must be a valid UUID');
    }

    return { isValid: errors.length === 0, errors, sanitizedBody: body };
  }

  static validateBatchRequest(body) {
    const errors = [];

    if (!Array.isArray(body.texts)) {
      errors.push('Texts must be an array');
    } else {
      if (body.texts.length === 0) {
        errors.push('Texts array cannot be empty');
      }
      if (body.texts.length > 100) {
        errors.push('Batch processing limited to 100 texts maximum');
      }

      // Validate and sanitize each text
      body.texts = body.texts.map((text, index) => {
        if (typeof text !== 'string') {
          errors.push(`Text at index ${index} must be a string`);
          return text;
        }
        const sanitized = validator.escape(text.trim());
        if (sanitized.length > 5000) {
          errors.push(`Text at index ${index} exceeds 5,000 character limit for batch processing`);
        }
        return sanitized;
      }).filter(text => text.length > 0);
    }

    return { isValid: errors.length === 0, errors, sanitizedBody: body };
  }
}

// ENTERPRISE DATABASE SERVICE WITH CONNECTION POOLING
class DatabaseService {
  constructor(config) {
    this.supabase = createClient(config.url, config.key, {
      db: {
        pool: {
          max: 20,
          min: 5,
          acquireTimeoutMillis: 60000,
          createTimeoutMillis: 30000,
          destroyTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
          createRetryIntervalMillis: 200
        }
      }
    });
  }

  async withRetry(operation, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries})`, {
          error: error.message,
          stack: error.stack
        });
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  async getCachedResponse(cacheKey) {
    return this.withRetry(async () => {
      const { data, error } = await this.supabase
        .from('ai_response_cache')
        .select('*')
        .eq('cache_key', cacheKey)
        .gte('expires_at', new Date().toISOString())
        .single();
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      
      return data;
    });
  }

  async setCachedResponse(cacheKey, responseData, context, ttlHours = 168) {
    return this.withRetry(async () => {
      const expiresAt = new Date(Date.now() + (ttlHours * 60 * 60 * 1000));
      
      const { error } = await this.supabase
        .from('ai_response_cache')
        .upsert({
          cache_key: cacheKey,
          response_data: responseData,
          context: context,
          model_used: 'gpt-4o-mini',
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        }, {
          onConflict: 'cache_key'
        });
      
      if (error) throw error;
    });
  }

  async storeSentimentAnalysis(data) {
    return this.withRetry(async () => {
      const { error } = await this.supabase
        .from('sentiment_analyses')
        .insert({
          organization_id: data.organizationId,
          original_text: data.originalText,
          sentiment: data.sentiment,
          confidence_score: data.confidenceScore,
          analysis_data: data.analysisData,
          model_used: data.modelUsed,
          context: data.context,
          cache_key: data.cacheKey,
          processing_time_ms: data.processingTime,
          tokens_used: data.tokensUsed,
          cost_estimate: data.costEstimate,
          created_at: new Date().toISOString()
        });
      
      if (error) throw error;
    });
  }

  async bulkStoreSentimentAnalyses(analyses) {
    return this.withRetry(async () => {
      const { error } = await this.supabase
        .from('sentiment_analyses')
        .insert(analyses);
      
      if (error) throw error;
    });
  }
}

// ENTERPRISE CACHE SERVICE WITH DISTRIBUTED LOCKING
class CacheService {
  constructor(dbService) {
    this.db = dbService;
    this.lockTimeout = 5000; // 5 seconds
  }

  generateCacheKey(text, context, options = {}) {
    const normalizedInput = {
      text: text.trim().toLowerCase().replace(/\s+/g, ' '),
      context: context || 'general',
      model: 'gpt-4o-mini',
      options: this._sanitizeOptions(options)
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(normalizedInput))
      .digest('hex');
  }

  async getCachedResponse(cacheKey, lockKey = null) {
    try {
      // Implement optimistic locking to prevent race conditions
      if (lockKey) {
        const lockAcquired = await this._acquireLock(lockKey);
        if (!lockAcquired) {
          logger.warn('Failed to acquire cache lock', { cacheKey, lockKey });
          return null;
        }
      }

      const cached = await this.db.getCachedResponse(cacheKey);
      
      if (cached) {
        logger.info('Cache hit', { 
          cacheKey: cacheKey.substring(0, 8) + '...', 
          context: cached.context,
          age: Math.round((Date.now() - new Date(cached.created_at).getTime()) / 1000 / 60) // minutes
        });
        
        return {
          ...cached.response_data,
          cached: true,
          cachedAt: cached.created_at,
          cacheKey: cacheKey.substring(0, 8) + '...'
        };
      }
      
      return null;
    } catch (error) {
      logger.error('Cache retrieval error', { error: error.message, cacheKey });
      return null; // Graceful degradation
    } finally {
      if (lockKey) {
        await this._releaseLock(lockKey);
      }
    }
  }

  async setCachedResponse(cacheKey, responseData, context) {
    try {
      await this.db.setCachedResponse(cacheKey, responseData, context);
      logger.info('Response cached', { 
        cacheKey: cacheKey.substring(0, 8) + '...', 
        context,
        responseSize: JSON.stringify(responseData).length 
      });
    } catch (error) {
      logger.error('Cache storage error', { error: error.message, cacheKey });
      // Don't throw - cache failure shouldn't break the main flow
    }
  }

  async _acquireLock(lockKey, timeoutMs = this.lockTimeout) {
    // Simplified distributed lock implementation
    // In production, use Redis or proper distributed lock manager
    const lockId = crypto.randomUUID();
    const expiry = new Date(Date.now() + timeoutMs).toISOString();
    
    try {
      const { error } = await this.db.supabase
        .from('cache_locks')
        .insert({
          lock_key: lockKey,
          lock_id: lockId,
          expires_at: expiry,
          created_at: new Date().toISOString()
        });
      
      return !error;
    } catch {
      return false;
    }
  }

  async _releaseLock(lockKey) {
    try {
      await this.db.supabase
        .from('cache_locks')
        .delete()
        .eq('lock_key', lockKey);
    } catch (error) {
      logger.warn('Lock release error', { error: error.message, lockKey });
    }
  }

  _sanitizeOptions(options) {
    const sanitized = {};
    const allowedKeys = ['include_reasoning', 'temperature', 'max_tokens'];
    
    for (const key of allowedKeys) {
      if (options.hasOwnProperty(key)) {
        sanitized[key] = options[key];
      }
    }
    
    return sanitized;
  }
}

// ENTERPRISE AI SERVICE WITH CIRCUIT BREAKER
class AIService {
  constructor(config) {
    this.config = config;
    this.openai = new OpenAIApi(new Configuration({
      apiKey: config.openAIKey
    }));

    // Circuit breaker for OpenAI API
    this.circuitBreaker = new CircuitBreaker(this._makeAPICall.bind(this), {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 60000, // 1 minute
      rollingCountTimeout: 60000,
      rollingCountBuckets: 10
    });

    this.circuitBreaker.fallback(() => {
      throw new Error('OpenAI API circuit breaker is open - service temporarily unavailable');
    });

    this.circuitBreaker.on('open', () => {
      logger.error('OpenAI API circuit breaker opened');
    });

    this.circuitBreaker.on('close', () => {
      logger.info('OpenAI API circuit breaker closed');
    });
  }

  async analyzeSentiment(text, context = 'general', options = {}) {
    const startTime = Date.now();
    
    try {
      const prompt = this._buildSentimentPrompt(text, context, options);
      const response = await this.circuitBreaker.fire(prompt);
      
      const analysisResult = this._parseSentimentResponse(response);
      
      // Add metadata
      analysisResult.processingTime = Date.now() - startTime;
      analysisResult.modelUsed = this.config.aiModel.model;
      analysisResult.tokensUsed = response.usage?.total_tokens || 0;
      analysisResult.costEstimate = this._calculateCost(analysisResult.tokensUsed);
      analysisResult.timestamp = new Date().toISOString();
      
      logger.info('Sentiment analysis completed', {
        sentiment: analysisResult.sentiment,
        confidence: analysisResult.confidenceScore,
        processingTime: analysisResult.processingTime,
        tokensUsed: analysisResult.tokensUsed
      });
      
      return analysisResult;
      
    } catch (error) {
      logger.error('Sentiment analysis failed', {
        error: error.message,
        context,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  async _makeAPICall(prompt) {
    return await this.openai.createChatCompletion({
      model: this.config.aiModel.model,
      messages: [
        {
          role: 'system',
          content: 'You are a precision sentiment analyst. Respond with valid JSON only. Focus on business-critical insights.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: this.config.aiModel.temperature,
      max_tokens: this.config.aiModel.maxTokens
    });
  }

  _buildSentimentPrompt(text, context, options) {
    return `
    Analyze sentiment of this ${context} text with maximum precision:
    
    Text: "${text}"
    
    Respond with ONLY this JSON format:
    {
      "sentiment": "positive|negative|neutral",
      "confidenceScore": 0.95,
      "emotionBreakdown": {
        "joy": 0.4,
        "anger": 0.0,
        "sadness": 0.0,
        "fear": 0.0,
        "surprise": 0.1,
        "disgust": 0.0,
        "trust": 0.5
      },
      "keyTopics": ["service", "quality", "experience"],
      "urgencyLevel": "low|medium|high|critical",
      "businessImpact": "positive|negative|neutral",
      "recommendedAction": "respond_immediately|respond_within_24h|monitor|no_action",
      ${options.includeReasoning ? '"reasoning": "Detailed analysis explanation",' : ''}
      "specificIssues": [],
      "positiveHighlights": ["highlight1", "highlight2"],
      "crisisIndicators": [],
      "sentimentScore": 0.8
    }
    
    Context: ${context}. Be precise and actionable.
    `;
  }

  _parseSentimentResponse(response) {
    try {
      const content = response.data.choices[0].message.content.trim();
      let parsed = JSON.parse(content);
      
      // Validate required fields
      const required = ['sentiment', 'confidenceScore', 'businessImpact'];
      for (const field of required) {
        if (!parsed.hasOwnProperty(field)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
      
      // Normalize field names to camelCase
      if (parsed.confidence_score) {
        parsed.confidenceScore = parsed.confidence_score;
        delete parsed.confidence_score;
      }
      
      return parsed;
      
    } catch (parseError) {
      logger.error('Failed to parse sentiment response', { parseError: parseError.message });
      
      // Try to extract JSON from response
      const content = response.data.choices[0].message.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          throw new Error('Could not parse JSON from OpenAI response');
        }
      }
      
      throw new Error('Invalid response format from OpenAI');
    }
  }

  _calculateCost(tokensUsed) {
    return (tokensUsed / 1000) * this.config.aiModel.costPer1kTokens;
  }
}

// ENTERPRISE SENTIMENT ENGINE SERVICE
class SentimentEngineService {
  constructor() {
    this.config = new ConfigManager();
    this.db = new DatabaseService(this.config.supabaseConfig);
    this.cache = new CacheService(this.db);
    this.ai = new AIService(this.config);
  }

  async analyzeSentiment(request) {
    const { text, context, organizationId, includeReasoning } = request;
    const startTime = Date.now();
    
    try {
      // Generate cache key
      const cacheKey = this.cache.generateCacheKey(text, context, { includeReasoning });
      const lockKey = `sentiment_${cacheKey}`;
      
      // Check cache first
      const cachedResult = await this.cache.getCachedResponse(cacheKey, lockKey);
      if (cachedResult) {
        return {
          success: true,
          sentimentAnalysis: cachedResult,
          cacheHit: true,
          processingTimeMs: Date.now() - startTime
        };
      }
      
      // Cache miss - call AI service
      logger.info('Cache miss - calling AI service', { cacheKey: cacheKey.substring(0, 8) + '...' });
      const analysisResult = await this.ai.analyzeSentiment(text, context, { includeReasoning });
      
      // Cache the result
      await this.cache.setCachedResponse(cacheKey, analysisResult, context);
      
      // Store analytics (fire and forget)
      if (organizationId) {
        this._storeAnalyticsAsync(organizationId, {
          originalText: text,
          analysisResult,
          cacheKey,
          context
        });
      }
      
      return {
        success: true,
        sentimentAnalysis: analysisResult,
        cacheHit: false,
        cachedForFuture: true,
        processingTimeMs: Date.now() - startTime
      };
      
    } catch (error) {
      logger.error('Sentiment analysis service error', {
        error: error.message,
        stack: error.stack,
        organizationId,
        context
      });
      
      throw new Error(`Sentiment analysis failed: ${error.message}`);
    }
  }

  async batchAnalyzeSentiment(request) {
    const { texts, context, organizationId } = request;
    const batchStartTime = Date.now();
    
    try {
      logger.info('Starting batch sentiment analysis', { 
        batchSize: texts.length, 
        organizationId,
        context 
      });
      
      let cacheHits = 0;
      let apiCalls = 0;
      
      // Process in parallel with concurrency control
      const concurrency = 5; // Process 5 at a time to avoid overwhelming the API
      const results = [];
      
      for (let i = 0; i < texts.length; i += concurrency) {
        const batch = texts.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (text, batchIndex) => {
          const globalIndex = i + batchIndex;
          
          try {
            const result = await this.analyzeSentiment({
              text,
              context,
              organizationId,
              includeReasoning: false
            });
            
            if (result.cacheHit) {
              cacheHits++;
            } else {
              apiCalls++;
            }
            
            return {
              index: globalIndex,
              text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
              success: true,
              sentimentAnalysis: result.sentimentAnalysis,
              cacheHit: result.cacheHit
            };
            
          } catch (error) {
            logger.error('Batch item analysis failed', {
              index: globalIndex,
              error: error.message
            });
            
            return {
              index: globalIndex,
              text: text.substring(0, 100) + '...',
              success: false,
              error: error.message
            };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to respect rate limits
        if (i + concurrency < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Calculate statistics
      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);
      const sentimentCounts = {
        positive: successful.filter(r => r.sentimentAnalysis?.sentiment === 'positive').length,
        negative: successful.filter(r => r.sentimentAnalysis?.sentiment === 'negative').length,
        neutral: successful.filter(r => r.sentimentAnalysis?.sentiment === 'neutral').length
      };
      
      const totalTime = Date.now() - batchStartTime;
      const cacheHitRate = Math.round((cacheHits / texts.length) * 100);
      
      logger.info('Batch sentiment analysis completed', {
        totalProcessed: texts.length,
        successful: successful.length,
        failed: failed.length,
        cacheHits,
        apiCalls,
        cacheHitRate,
        totalTimeMs: totalTime
      });
      
      return {
        success: true,
        batchSummary: {
          totalProcessed: texts.length,
          successful: successful.length,
          failed: failed.length,
          cacheHits,
          apiCalls,
          cacheHitRate,
          sentimentDistribution: sentimentCounts,
          processingTimeMs: totalTime,
          averageTimePerTextMs: Math.round(totalTime / texts.length),
          costSavedByCache: cacheHits * this.config.aiModel.costPer1kTokens * 100
        },
        results
      };
      
    } catch (error) {
      logger.error('Batch sentiment analysis error', {
        error: error.message,
        stack: error.stack,
        batchSize: texts.length
      });
      
      throw new Error(`Batch analysis failed: ${error.message}`);
    }
  }

  async _storeAnalyticsAsync(organizationId, data) {
    // Fire and forget analytics storage
    setImmediate(async () => {
      try {
        await this.db.storeSentimentAnalysis({
          organizationId,
          originalText: data.originalText,
          sentiment: data.analysisResult.sentiment,
          confidenceScore: data.analysisResult.confidenceScore,
          analysisData: data.analysisResult,
          modelUsed: data.analysisResult.modelUsed,
          context: data.context,
          cacheKey: data.cacheKey,
          processingTime: data.analysisResult.processingTime,
          tokensUsed: data.analysisResult.tokensUsed,
          costEstimate: data.analysisResult.costEstimate
        });
      } catch (error) {
        logger.error('Analytics storage failed', { error: error.message, organizationId });
      }
    });
  }
}

// ENTERPRISE ERROR HANDLING MIDDLEWARE
class ErrorHandler {
  static handle(error, context = {}) {
    const errorId = crypto.randomUUID();
    
    const errorInfo = {
      errorId,
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    };
    
    logger.error('Unhandled error', errorInfo);
    
    // Determine error type and appropriate response
    if (error.message.includes('circuit breaker')) {
      return {
        statusCode: 503,
        error: 'AI service temporarily unavailable',
        errorId,
        retryAfter: 60
      };
    }
    
    if (error.message.includes('rate limit')) {
      return {
        statusCode: 429,
        error: 'Too many requests',
        errorId,
        retryAfter: 900
      };
    }
    
    if (error.message.includes('validation')) {
      return {
        statusCode: 400,
        error: error.message,
        errorId
      };
    }
    
    // Generic server error
    return {
      statusCode: 500,
      error: 'Internal server error',
      errorId
    };
  }
}

// ENTERPRISE RATE LIMITER
const createRateLimiter = (config) => {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: config.standardHeaders,
    legacyHeaders: config.legacyHeaders,
    message: {
      error: 'Too many requests',
      retryAfter: Math.ceil(config.windowMs / 1000)
    },
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(config.windowMs / 1000)
      });
    }
  });
};

// MAIN HANDLER WITH ENTERPRISE ARCHITECTURE
exports.handler = async (event, context) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  // Enterprise headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Request-ID': requestId,
    'X-API-Version': '2.0',
    'X-Service': 'enterprise-ai-sentiment-engine'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const requestContext = {
    requestId,
    method: event.httpMethod,
    path: event.path,
    userAgent: event.headers['user-agent'],
    ip: event.headers['x-forwarded-for'] || event.requestContext?.identity?.sourceIp
  };

  logger.info('Request started', requestContext);

  try {
    // Initialize service (singleton pattern in production)
    const sentimentEngine = new SentimentEngineService();
    
    // Parse and validate request
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    if (!action) {
      throw new Error('Action parameter is required');
    }

    let result;
    
    switch (action) {
      case 'analyze_sentiment':
        const validation = InputValidator.validateSentimentRequest(body);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        result = await sentimentEngine.analyzeSentiment({
          text: validation.sanitizedBody.text,
          context: validation.sanitizedBody.context || 'general',
          organizationId: validation.sanitizedBody.organization_id,
          includeReasoning: validation.sanitizedBody.include_reasoning || false
        });
        break;
        
      case 'batch_analyze':
        const batchValidation = InputValidator.validateBatchRequest(body);
        if (!batchValidation.isValid) {
          throw new Error(`Validation failed: ${batchValidation.errors.join(', ')}`);
        }
        
        result = await sentimentEngine.batchAnalyzeSentiment({
          texts: batchValidation.sanitizedBody.texts,
          context: batchValidation.sanitizedBody.context || 'general',
          organizationId: batchValidation.sanitizedBody.organization_id
        });
        break;
        
      default:
        throw new Error(`Unsupported action: ${action}`);
    }

    const responseTime = Date.now() - startTime;
    
    logger.info('Request completed', {
      ...requestContext,
      action,
      responseTime,
      success: true
    });

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'X-Response-Time': `${responseTime}ms`
      },
      body: JSON.stringify({
        ...result,
        requestId,
        responseTime
      })
    };

  } catch (error) {
    const errorResponse = ErrorHandler.handle(error, requestContext);
    
    logger.error('Request failed', {
      ...requestContext,
      error: error.message,
      responseTime: Date.now() - startTime
    });

    return {
      statusCode: errorResponse.statusCode,
      headers: {
        ...headers,
        'X-Error-ID': errorResponse.errorId,
        ...(errorResponse.retryAfter && { 'Retry-After': errorResponse.retryAfter })
      },
      body: JSON.stringify(errorResponse)
    };
  }
};