// ENTERPRISE SECURITY MIDDLEWARE - SENIOR DEVELOPER SECURITY HARDENING
// WAF, DDoS Protection, Input Sanitization, Encryption, Secrets Management
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const validator = require('validator');
const xss = require('xss');
const { body, validationResult, sanitizeBody } = require('express-validator');
const winston = require('winston');

// ENTERPRISE SECURITY LOGGER
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'security-middleware' },
  transports: [
    new winston.transports.File({ filename: 'security.log', level: 'warn' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// ENTERPRISE SECRETS MANAGEMENT
class SecretsManager {
  constructor() {
    this.encryptionKey = this._getOrCreateEncryptionKey();
    this.secrets = new Map();
    this._loadSecrets();
  }

  _getOrCreateEncryptionKey() {
    // In production, use AWS KMS, Azure Key Vault, or HashiCorp Vault
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    if (key.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 characters (256-bit hex)');
    }
    
    return Buffer.from(key, 'hex');
  }

  _loadSecrets() {
    // Load and decrypt secrets from secure storage
    const secretsConfig = {
      'OPENAI_API_KEY': process.env.OPENAI_API_KEY_ENCRYPTED,
      'SUPABASE_SERVICE_KEY': process.env.SUPABASE_SERVICE_KEY_ENCRYPTED,
      'JWT_SECRET': process.env.JWT_SECRET_ENCRYPTED
    };

    for (const [key, encryptedValue] of Object.entries(secretsConfig)) {
      if (encryptedValue) {
        try {
          this.secrets.set(key, this._decrypt(encryptedValue));
        } catch (error) {
          securityLogger.error(`Failed to decrypt secret: ${key}`, { error: error.message });
          throw new Error(`Secret decryption failed: ${key}`);
        }
      } else {
        // Fallback to plaintext for development (log warning)
        const plaintextValue = process.env[key];
        if (plaintextValue) {
          securityLogger.warn(`Using plaintext secret: ${key} (not recommended for production)`);
          this.secrets.set(key, plaintextValue);
        }
      }
    }
  }

  getSecret(name) {
    const secret = this.secrets.get(name);
    if (!secret) {
      throw new Error(`Secret not found: ${name}`);
    }
    return secret;
  }

  _encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
    cipher.setAAD(Buffer.from('enterprise-secrets'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  _decrypt(encryptedText) {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
    decipher.setAAD(Buffer.from('enterprise-secrets'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Utility method to encrypt secrets for storage
  encryptSecret(plaintext) {
    return this._encrypt(plaintext);
  }
}

// ENTERPRISE WAF (Web Application Firewall)
class EnterpriseWAF {
  constructor() {
    this.suspiciousPatterns = [
      // SQL Injection patterns
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
      /((\%27)|(\'))union/gi,
      
      // XSS patterns
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      
      // Path traversal
      /\.\.\//gi,
      /%2e%2e%2f/gi,
      
      // Command injection
      /[;&|`$\(\)]/g,
      
      // LDAP injection
      /[()&|]/g
    ];

    this.blockedUserAgents = [
      /bot/gi,
      /crawler/gi,
      /scanner/gi,
      /nikto/gi,
      /sqlmap/gi,
      /nmap/gi
    ];

    this.rateLimiters = new Map();
  }

  analyzeRequest(req) {
    const analysis = {
      riskScore: 0,
      threats: [],
      blocked: false,
      requestId: crypto.randomUUID()
    };

    // Analyze URL
    this._analyzeURL(req.url, analysis);
    
    // Analyze headers
    this._analyzeHeaders(req.headers, analysis);
    
    // Analyze body if present
    if (req.body) {
      this._analyzeBody(req.body, analysis);
    }

    // Check user agent
    this._analyzeUserAgent(req.headers['user-agent'], analysis);

    // Geographic analysis (if GeoIP available)
    this._analyzeGeography(req.ip, analysis);

    // Rate limiting analysis
    this._analyzeRateLimit(req.ip, req.url, analysis);

    // Final risk assessment
    analysis.blocked = analysis.riskScore >= 80;
    analysis.riskLevel = this._getRiskLevel(analysis.riskScore);

    return analysis;
  }

  _analyzeURL(url, analysis) {
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(url)) {
        analysis.riskScore += 25;
        analysis.threats.push({
          type: 'suspicious_url_pattern',
          pattern: pattern.toString(),
          severity: 'high'
        });
      }
    }

    // Check for excessively long URLs
    if (url.length > 2000) {
      analysis.riskScore += 15;
      analysis.threats.push({
        type: 'long_url',
        length: url.length,
        severity: 'medium'
      });
    }
  }

  _analyzeHeaders(headers, analysis) {
    // Check for missing security headers
    if (!headers['user-agent']) {
      analysis.riskScore += 20;
      analysis.threats.push({
        type: 'missing_user_agent',
        severity: 'medium'
      });
    }

    // Check for suspicious header values
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        for (const pattern of this.suspiciousPatterns) {
          if (pattern.test(value)) {
            analysis.riskScore += 20;
            analysis.threats.push({
              type: 'suspicious_header',
              header: key,
              severity: 'high'
            });
          }
        }
      }
    }

    // Check Content-Length vs actual body size
    if (headers['content-length']) {
      const declaredLength = parseInt(headers['content-length']);
      if (declaredLength > 10 * 1024 * 1024) { // 10MB limit
        analysis.riskScore += 30;
        analysis.threats.push({
          type: 'large_payload',
          size: declaredLength,
          severity: 'high'
        });
      }
    }
  }

  _analyzeBody(body, analysis) {
    const bodyString = typeof body === 'string' ? body : JSON.stringify(body);
    
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(bodyString)) {
        analysis.riskScore += 30;
        analysis.threats.push({
          type: 'suspicious_payload',
          pattern: pattern.toString(),
          severity: 'critical'
        });
      }
    }

    // Check for binary content in text fields
    if (bodyString.includes('\x00') || /[\x01-\x08\x0B\x0C\x0E-\x1F]/.test(bodyString)) {
      analysis.riskScore += 25;
      analysis.threats.push({
        type: 'binary_content',
        severity: 'high'
      });
    }
  }

  _analyzeUserAgent(userAgent, analysis) {
    if (!userAgent) return;

    for (const pattern of this.blockedUserAgents) {
      if (pattern.test(userAgent)) {
        analysis.riskScore += 50;
        analysis.threats.push({
          type: 'blocked_user_agent',
          userAgent,
          severity: 'high'
        });
      }
    }
  }

  _analyzeGeography(ip, analysis) {
    // Placeholder for GeoIP analysis
    // In production, integrate with MaxMind GeoIP2 or similar
    if (ip && this._isKnownMaliciousIP(ip)) {
      analysis.riskScore += 40;
      analysis.threats.push({
        type: 'malicious_ip',
        ip,
        severity: 'high'
      });
    }
  }

  _analyzeRateLimit(ip, url, analysis) {
    const key = `${ip}:${url}`;
    const now = Date.now();
    const window = 60000; // 1 minute
    
    if (!this.rateLimiters.has(key)) {
      this.rateLimiters.set(key, []);
    }
    
    const requests = this.rateLimiters.get(key);
    
    // Clean old requests
    while (requests.length > 0 && requests[0] < now - window) {
      requests.shift();
    }
    
    requests.push(now);
    
    // Check rate limit
    if (requests.length > 100) { // 100 requests per minute
      analysis.riskScore += 35;
      analysis.threats.push({
        type: 'rate_limit_exceeded',
        requestCount: requests.length,
        severity: 'high'
      });
    }
  }

  _isKnownMaliciousIP(ip) {
    // Placeholder - integrate with threat intelligence feeds
    const knownMaliciousIPs = [
      '1.2.3.4', // Example malicious IP
    ];
    
    return knownMaliciousIPs.includes(ip);
  }

  _getRiskLevel(score) {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
}

// ENTERPRISE INPUT SANITIZATION
class InputSanitizer {
  static sanitizeText(text) {
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }

    // Remove null bytes
    let sanitized = text.replace(/\x00/g, '');
    
    // HTML encode dangerous characters
    sanitized = validator.escape(sanitized);
    
    // XSS protection
    sanitized = xss(sanitized, {
      whiteList: {}, // No HTML tags allowed
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
    
    // Remove control characters except newlines and tabs
    sanitized = sanitized.replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, '');
    
    // Normalize whitespace
    sanitized = sanitized.replace(/\s+/g, ' ').trim();
    
    return sanitized;
  }

  static sanitizeJSON(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeJSON(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize key
      const sanitizedKey = this.sanitizeText(key);
      
      // Sanitize value
      if (typeof value === 'string') {
        sanitized[sanitizedKey] = this.sanitizeText(value);
      } else if (typeof value === 'object') {
        sanitized[sanitizedKey] = this.sanitizeJSON(value);
      } else {
        sanitized[sanitizedKey] = value;
      }
    }

    return sanitized;
  }

  static validateAndSanitizeRequest(body) {
    const errors = [];
    
    if (!body || typeof body !== 'object') {
      errors.push('Request body must be a valid JSON object');
      return { isValid: false, errors, sanitizedBody: null };
    }

    try {
      const sanitizedBody = this.sanitizeJSON(body);
      
      // Additional validation rules
      if (sanitizedBody.text && sanitizedBody.text.length > 10000) {
        errors.push('Text length exceeds maximum limit of 10,000 characters');
      }

      if (sanitizedBody.texts && Array.isArray(sanitizedBody.texts)) {
        if (sanitizedBody.texts.length > 100) {
          errors.push('Batch size exceeds maximum limit of 100 items');
        }
        
        sanitizedBody.texts = sanitizedBody.texts
          .filter(text => typeof text === 'string' && text.trim().length > 0)
          .slice(0, 100); // Hard limit
      }

      return {
        isValid: errors.length === 0,
        errors,
        sanitizedBody
      };
      
    } catch (error) {
      errors.push(`Sanitization failed: ${error.message}`);
      return { isValid: false, errors, sanitizedBody: null };
    }
  }
}

// ENTERPRISE RATE LIMITING
class EnterpriseRateLimiter {
  constructor() {
    this.limiters = {
      // Aggressive rate limiting for AI endpoints
      aiAnalysis: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 50, // 50 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
          return `ai:${req.ip}:${req.headers['user-agent'] || 'unknown'}`;
        },
        handler: (req, res) => {
          securityLogger.warn('AI analysis rate limit exceeded', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.url
          });
          
          res.status(429).json({
            error: 'Too many AI analysis requests',
            retryAfter: 900, // 15 minutes
            limit: 50,
            window: '15 minutes'
          });
        }
      }),

      // Batch processing rate limiting
      batchProcessing: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // 10 batch requests per hour
        keyGenerator: (req) => `batch:${req.ip}`,
        handler: (req, res) => {
          securityLogger.warn('Batch processing rate limit exceeded', {
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });
          
          res.status(429).json({
            error: 'Too many batch processing requests',
            retryAfter: 3600,
            limit: 10,
            window: '1 hour'
          });
        }
      }),

      // Global API rate limiting
      global: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 200, // 200 requests per window
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          securityLogger.warn('Global rate limit exceeded', {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
            endpoint: req.url
          });
          
          res.status(429).json({
            error: 'Too many requests',
            retryAfter: 900,
            limit: 200,
            window: '15 minutes'
          });
        }
      }),

      // Progressive slowdown for suspicious behavior
      slowDown: slowDown({
        windowMs: 15 * 60 * 1000, // 15 minutes
        delayAfter: 10, // Start slowing down after 10 requests
        delayMs: 500, // Add 500ms delay per request
        maxDelayMs: 20000, // Max 20 second delay
        keyGenerator: (req) => `slowdown:${req.ip}`,
        onLimitReached: (req, res, options) => {
          securityLogger.warn('Slowdown limit reached', {
            ip: req.ip,
            userAgent: req.headers['user-agent']
          });
        }
      })
    };
  }

  getLimiter(type) {
    return this.limiters[type] || this.limiters.global;
  }
}

// ENTERPRISE SECURITY MIDDLEWARE ORCHESTRATOR
class SecurityMiddleware {
  constructor() {
    this.secretsManager = new SecretsManager();
    this.waf = new EnterpriseWAF();
    this.sanitizer = InputSanitizer;
    this.rateLimiter = new EnterpriseRateLimiter();
    
    this.helmetConfig = {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    };
  }

  // Main security middleware function
  async securityCheck(req, res, next) {
    const startTime = Date.now();
    const requestId = crypto.randomUUID();
    
    try {
      // 1. WAF Analysis
      const wafAnalysis = this.waf.analyzeRequest(req);
      
      if (wafAnalysis.blocked) {
        securityLogger.error('Request blocked by WAF', {
          requestId,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
          url: req.url,
          riskScore: wafAnalysis.riskScore,
          threats: wafAnalysis.threats
        });
        
        return res.status(403).json({
          error: 'Request blocked by security policy',
          requestId,
          code: 'WAF_BLOCKED'
        });
      }

      // 2. Input Sanitization
      if (req.body && Object.keys(req.body).length > 0) {
        const sanitizationResult = this.sanitizer.validateAndSanitizeRequest(req.body);
        
        if (!sanitizationResult.isValid) {
          securityLogger.warn('Request failed input validation', {
            requestId,
            ip: req.ip,
            errors: sanitizationResult.errors
          });
          
          return res.status(400).json({
            error: 'Input validation failed',
            details: sanitizationResult.errors,
            requestId,
            code: 'INPUT_VALIDATION_FAILED'
          });
        }
        
        req.body = sanitizationResult.sanitizedBody;
      }

      // 3. Security Headers
      helmet(this.helmetConfig)(req, res, (err) => {
        if (err) {
          securityLogger.error('Helmet middleware error', { error: err.message, requestId });
        }
      });

      // 4. Add security context to request
      req.security = {
        requestId,
        wafAnalysis,
        riskLevel: wafAnalysis.riskLevel,
        processingTime: Date.now() - startTime
      };

      // 5. Log security event
      securityLogger.info('Security check passed', {
        requestId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        url: req.url,
        riskScore: wafAnalysis.riskScore,
        riskLevel: wafAnalysis.riskLevel,
        processingTime: req.security.processingTime
      });

      next();
      
    } catch (error) {
      securityLogger.error('Security middleware error', {
        requestId,
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        url: req.url
      });
      
      return res.status(500).json({
        error: 'Security check failed',
        requestId,
        code: 'SECURITY_ERROR'
      });
    }
  }

  // Method to get secrets securely
  getSecret(name) {
    return this.secretsManager.getSecret(name);
  }

  // Method to get rate limiter
  getRateLimiter(type) {
    return this.rateLimiter.getLimiter(type);
  }
}

module.exports = {
  SecurityMiddleware,
  SecretsManager,
  EnterpriseWAF,
  InputSanitizer,
  EnterpriseRateLimiter
};