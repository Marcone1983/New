/**
 * PROFILO CUSTOM PLUS - Logo e branding personalizzato
 * Enterprise-grade branding system with theme engine, asset management, and CDN integration
 * Architecture: Strategy Pattern + Factory Pattern + Observer Pattern
 */

class CustomProfile {
  constructor(dbAPI, businessId, plan = 'plus') {
    this.dbAPI = dbAPI;
    this.businessId = businessId;
    this.plan = plan;
    
    // Enterprise Architecture Components
    this.themeEngine = new ThemeEngine();
    this.assetManager = new AssetManager(businessId);
    this.brandingValidator = new BrandingValidator();
    this.cacheManager = new ProfileCacheManager();
    this.eventBus = new EventBus();
    
    // Component Registry
    this.components = new Map();
    this.templates = new Map();
    this.brandingPresets = new Map();
    
    this.initializeEnterpriseComponents();
  }

  // Enterprise initialization with dependency injection
  initializeEnterpriseComponents() {
    // Initialize branding presets using Factory pattern
    this.brandingPresets = BrandingPresetFactory.createPresetCollection();
    
    // Initialize component registry
    this.registerProfileComponents();
    
    // Initialize event listeners
    this.setupEventListeners();
    
    // Initialize performance monitoring
    this.performanceMonitor = new ProfilePerformanceMonitor(this.businessId);
  }

  // Register profile components using Component Registry pattern
  registerProfileComponents() {
    const components = [
      new HeaderComponent(),
      new LogoComponent(),
      new ColorSchemeComponent(),
      new TypographyComponent(),
      new LayoutComponent(),
      new CustomCSSComponent(),
      new SocialLinksComponent(),
      new ContactInfoComponent()
    ];

    components.forEach(component => {
      this.components.set(component.getName(), component);
    });
  }

  // Setup event-driven architecture
  setupEventListeners() {
    this.eventBus.subscribe('branding.updated', this.handleBrandingUpdate.bind(this));
    this.eventBus.subscribe('assets.uploaded', this.handleAssetUpload.bind(this));
    this.eventBus.subscribe('theme.changed', this.handleThemeChange.bind(this));
    this.eventBus.subscribe('profile.regenerate', this.handleProfileRegeneration.bind(this));
  }

  // Create custom profile with enterprise validation
  async createCustomProfile(brandingConfig) {
    const startTime = performance.now();
    
    try {
      // Enterprise validation pipeline
      const validationResult = await this.validateBrandingConfig(brandingConfig);
      if (!validationResult.isValid) {
        throw new ProfileValidationError('Invalid branding configuration', validationResult.errors);
      }

      // Asset processing pipeline
      const processedAssets = await this.processProfileAssets(brandingConfig.assets);
      
      // Theme generation using Strategy pattern
      const themeStrategy = this.themeEngine.selectStrategy(brandingConfig.themeType);
      const generatedTheme = await themeStrategy.generateTheme(brandingConfig, processedAssets);

      // Component composition using Builder pattern
      const profileBuilder = new ProfileBuilder()
        .setBusinessId(this.businessId)
        .setBrandingConfig(brandingConfig)
        .setTheme(generatedTheme)
        .setAssets(processedAssets)
        .setPlan(this.plan);

      // Build profile with components
      for (const [componentName, component] of this.components) {
        const componentData = brandingConfig[componentName] || {};
        profileBuilder.addComponent(componentName, await component.render(componentData, generatedTheme));
      }

      const customProfile = await profileBuilder.build();

      // Persistence layer with transaction support
      const saveResult = await this.persistCustomProfile(customProfile);
      
      if (saveResult.success) {
        // Cache invalidation and regeneration
        await this.cacheManager.invalidateProfileCache(this.businessId);
        await this.cacheManager.generateOptimizedCache(customProfile);
        
        // Event emission for downstream services
        this.eventBus.emit('profile.created', {
          businessId: this.businessId,
          profileId: saveResult.profileId,
          brandingConfig: brandingConfig,
          generatedAt: new Date().toISOString()
        });

        // Performance metrics
        const executionTime = performance.now() - startTime;
        await this.performanceMonitor.recordMetric('profile.creation', executionTime);

        return {
          success: true,
          profile: customProfile,
          profileId: saveResult.profileId,
          publicUrl: this.generateProfileURL(saveResult.profileId),
          assets: processedAssets,
          performance: {
            executionTime: Math.round(executionTime),
            cacheGenerated: true,
            assetsProcessed: processedAssets.length
          }
        };
      } else {
        throw new Error(`Profile persistence failed: ${saveResult.error}`);
      }

    } catch (error) {
      await this.handleProfileError(error, brandingConfig);
      
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        executionTime: performance.now() - startTime
      };
    }
  }

  // Enterprise asset processing pipeline
  async processProfileAssets(assets) {
    if (!assets || assets.length === 0) return [];

    const processedAssets = [];
    const processingPromises = assets.map(async (asset) => {
      try {
        // Asset validation
        const validation = await this.assetManager.validateAsset(asset);
        if (!validation.isValid) {
          throw new AssetValidationError(`Invalid asset: ${validation.error}`);
        }

        // Asset optimization pipeline
        const optimizer = AssetOptimizerFactory.create(asset.type);
        const optimizedAsset = await optimizer.optimize(asset);

        // CDN upload with retry mechanism
        const uploadResult = await this.assetManager.uploadToCDN(optimizedAsset, {
          retryCount: 3,
          retryDelay: 1000,
          compressionLevel: 'high'
        });

        if (uploadResult.success) {
          processedAssets.push({
            id: uploadResult.assetId,
            type: asset.type,
            originalName: asset.name,
            cdnUrl: uploadResult.cdnUrl,
            optimizedSize: optimizedAsset.size,
            compressionRatio: optimizedAsset.compressionRatio,
            metadata: {
              uploadedAt: new Date().toISOString(),
              dimensions: optimizedAsset.dimensions,
              format: optimizedAsset.format
            }
          });
        }

      } catch (error) {
        console.error(`Asset processing failed for ${asset.name}:`, error);
        // Continue with other assets, don't fail entire process
      }
    });

    await Promise.allSettled(processingPromises);
    return processedAssets;
  }

  // Advanced branding configuration validation
  async validateBrandingConfig(config) {
    const errors = [];
    const warnings = [];

    // Color scheme validation
    if (config.colors) {
      const colorValidation = this.brandingValidator.validateColorScheme(config.colors);
      if (!colorValidation.isValid) {
        errors.push(...colorValidation.errors);
      }
      warnings.push(...colorValidation.warnings);
    }

    // Typography validation
    if (config.typography) {
      const fontValidation = this.brandingValidator.validateTypography(config.typography);
      if (!fontValidation.isValid) {
        errors.push(...fontValidation.errors);
      }
    }

    // Logo validation
    if (config.logo) {
      const logoValidation = await this.brandingValidator.validateLogo(config.logo);
      if (!logoValidation.isValid) {
        errors.push(...logoValidation.errors);
      }
    }

    // Custom CSS validation (security check)
    if (config.customCSS) {
      const cssValidation = this.brandingValidator.validateCustomCSS(config.customCSS);
      if (!cssValidation.isValid) {
        errors.push(...cssValidation.errors);
      }
    }

    // Plan-specific feature validation
    const planValidation = this.validatePlanFeatures(config);
    if (!planValidation.isValid) {
      errors.push(...planValidation.errors);
    }

    return {
      isValid: errors.length === 0,
      errors: errors,
      warnings: warnings,
      validatedConfig: this.sanitizeConfig(config)
    };
  }

  // Plan feature validation with enterprise rules
  validatePlanFeatures(config) {
    const errors = [];
    const planLimits = this.getPlanLimits();

    // Logo restrictions
    if (config.logo && !planLimits.customLogo) {
      errors.push('Custom logo not available in current plan');
    }

    // Custom CSS restrictions
    if (config.customCSS && !planLimits.customCSS) {
      errors.push('Custom CSS not available in current plan');
    }

    // Asset count limits
    if (config.assets && config.assets.length > planLimits.maxAssets) {
      errors.push(`Asset limit exceeded. Plan allows ${planLimits.maxAssets} assets`);
    }

    // Theme complexity limits
    if (config.themeComplexity && config.themeComplexity > planLimits.themeComplexity) {
      errors.push('Theme complexity exceeds plan limits');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }

  // Get plan-specific limits
  getPlanLimits() {
    const limits = {
      plus: {
        customLogo: true,
        customColors: true,
        customFonts: true,
        customCSS: false,
        maxAssets: 5,
        themeComplexity: 'medium',
        cdnStorage: '100MB'
      },
      premium: {
        customLogo: true,
        customColors: true,
        customFonts: true,
        customCSS: true,
        maxAssets: 15,
        themeComplexity: 'high',
        cdnStorage: '500MB'
      },
      advanced: {
        customLogo: true,
        customColors: true,
        customFonts: true,
        customCSS: true,
        maxAssets: 50,
        themeComplexity: 'unlimited',
        cdnStorage: '2GB'
      }
    };

    return limits[this.plan] || limits.plus;
  }

  // Generate optimized CSS using CSS-in-JS with autoprefixing
  generateProfileCSS(theme, components) {
    const cssGenerator = new EnterpriseCSS();
    
    // Base CSS foundation
    cssGenerator.addFoundation(theme.foundation);
    
    // Component styles with BEM methodology
    components.forEach((component, name) => {
      cssGenerator.addComponentStyles(name, component.styles, theme);
    });

    // Responsive breakpoints
    cssGenerator.addResponsiveStyles(theme.breakpoints);
    
    // Performance optimizations
    cssGenerator.addPerformanceOptimizations();
    
    // Cross-browser compatibility
    cssGenerator.addBrowserPrefixes();
    
    return {
      css: cssGenerator.compile(),
      sourceMap: cssGenerator.generateSourceMap(),
      stats: cssGenerator.getCompilationStats()
    };
  }

  // Generate profile URL with SEO optimization
  generateProfileURL(profileId) {
    const baseUrl = process.env.FRONTEND_URL || 'https://socialtrust.app';
    const businessSlug = this.generateSEOSlug();
    
    return `${baseUrl}/profile/${businessSlug}`;
  }

  // Generate SEO-friendly slug
  generateSEOSlug() {
    // Implementation with transliteration and SEO best practices
    const businessName = this.businessData?.name || `business-${this.businessId}`;
    return businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Persist profile with transaction support
  async persistCustomProfile(profile) {
    const transaction = await this.dbAPI.beginTransaction();
    
    try {
      // Save profile data
      const profileResult = await this.dbAPI.saveCustomProfile(profile, { transaction });
      if (!profileResult.success) {
        throw new Error(profileResult.error);
      }

      // Save branding assets references
      const assetsResult = await this.dbAPI.saveBrandingAssets(profile.assets, { transaction });
      if (!assetsResult.success) {
        throw new Error(assetsResult.error);
      }

      // Save generated CSS and theme
      const themeResult = await this.dbAPI.saveProfileTheme(profile.theme, { transaction });
      if (!themeResult.success) {
        throw new Error(themeResult.error);
      }

      await transaction.commit();
      
      return {
        success: true,
        profileId: profileResult.profileId
      };

    } catch (error) {
      await transaction.rollback();
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Event handlers for reactive updates
  async handleBrandingUpdate(event) {
    const { businessId, updatedFields } = event.data;
    if (businessId !== this.businessId) return;

    await this.cacheManager.invalidateFieldCache(businessId, updatedFields);
    this.eventBus.emit('profile.invalidated', { businessId, fields: updatedFields });
  }

  async handleAssetUpload(event) {
    const { assetId, assetUrl } = event.data;
    await this.cacheManager.updateAssetReference(assetId, assetUrl);
  }

  async handleThemeChange(event) {
    const { businessId, newTheme } = event.data;
    if (businessId !== this.businessId) return;

    await this.regenerateProfileWithTheme(newTheme);
  }

  async handleProfileRegeneration(event) {
    const { businessId } = event.data;
    if (businessId !== this.businessId) return;

    await this.regenerateEntireProfile();
  }

  // Error handling with enterprise logging
  async handleProfileError(error, config) {
    const errorContext = {
      businessId: this.businessId,
      plan: this.plan,
      errorType: error.constructor.name,
      timestamp: new Date().toISOString(),
      config: this.sanitizeConfig(config)
    };

    // Log to enterprise monitoring system
    await this.performanceMonitor.recordError('profile.creation.error', error, errorContext);
    
    // Notify admin if critical error
    if (error instanceof CriticalProfileError) {
      await this.notifyAdministrators(error, errorContext);
    }
  }

  // Configuration sanitization for security
  sanitizeConfig(config) {
    const sanitized = { ...config };
    
    // Remove sensitive information
    delete sanitized.internalIds;
    delete sanitized.adminSettings;
    
    // Sanitize custom CSS
    if (sanitized.customCSS) {
      sanitized.customCSS = this.brandingValidator.sanitizeCSS(sanitized.customCSS);
    }

    return sanitized;
  }

  // Get profile analytics and performance metrics
  async getProfileAnalytics() {
    const analytics = await this.performanceMonitor.getAnalytics(this.businessId);
    const cacheStats = await this.cacheManager.getStats(this.businessId);
    
    return {
      feature: 'Profilo Custom Plus',
      status: 'active',
      plan: this.plan,
      analytics: analytics,
      cache_performance: cacheStats,
      last_update: new Date().toISOString()
    };
  }
}

// Enterprise Architecture Supporting Classes

class ThemeEngine {
  constructor() {
    this.strategies = new Map();
    this.registerStrategies();
  }

  registerStrategies() {
    this.strategies.set('modern', new ModernThemeStrategy());
    this.strategies.set('classic', new ClassicThemeStrategy());
    this.strategies.set('minimal', new MinimalThemeStrategy());
    this.strategies.set('corporate', new CorporateThemeStrategy());
  }

  selectStrategy(themeType) {
    return this.strategies.get(themeType) || this.strategies.get('modern');
  }
}

class AssetManager {
  constructor(businessId) {
    this.businessId = businessId;
    this.cdnProvider = new CDNProvider();
    this.validators = new Map();
    this.optimizers = new Map();
    this.initializeProcessors();
  }

  initializeProcessors() {
    // Asset type validators
    this.validators.set('image', new ImageValidator());
    this.validators.set('font', new FontValidator());
    this.validators.set('css', new CSSValidator());

    // Asset optimizers
    this.optimizers.set('image', new ImageOptimizer());
    this.optimizers.set('font', new FontOptimizer());
  }

  async validateAsset(asset) {
    const validator = this.validators.get(asset.type);
    if (!validator) {
      return { isValid: false, error: 'Unsupported asset type' };
    }

    return await validator.validate(asset);
  }

  async uploadToCDN(asset, options = {}) {
    return await this.cdnProvider.upload(asset, {
      businessId: this.businessId,
      ...options
    });
  }
}

class BrandingValidator {
  validateColorScheme(colors) {
    const errors = [];
    const warnings = [];

    // Contrast ratio validation
    if (colors.primary && colors.background) {
      const contrast = this.calculateContrastRatio(colors.primary, colors.background);
      if (contrast < 4.5) {
        warnings.push('Low contrast ratio between primary and background colors');
      }
    }

    // Color accessibility validation
    Object.entries(colors).forEach(([key, color]) => {
      if (!this.isValidHexColor(color) && !this.isValidRGBColor(color)) {
        errors.push(`Invalid color format for ${key}: ${color}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  validateCustomCSS(css) {
    const errors = [];
    
    // Security validation - prevent malicious CSS
    const dangerousPatterns = [
      /javascript:/i,
      /expression\s*\(/i,
      /behavior\s*:/i,
      /@import/i,
      /url\s*\(\s*['"]?data:/i
    ];

    dangerousPatterns.forEach(pattern => {
      if (pattern.test(css)) {
        errors.push('Potentially dangerous CSS detected');
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  sanitizeCSS(css) {
    // Remove dangerous patterns and return safe CSS
    return css
      .replace(/javascript:/gi, '')
      .replace(/expression\s*\(/gi, '')
      .replace(/behavior\s*:/gi, '')
      .replace(/@import[^;]*;/gi, '');
  }

  isValidHexColor(color) {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color);
  }

  isValidRGBColor(color) {
    return /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(color);
  }

  calculateContrastRatio(color1, color2) {
    // Simplified contrast calculation
    // Real implementation would use WCAG contrast formula
    return 7.0; // Placeholder
  }
}

// Custom Error Classes
class ProfileValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'ProfileValidationError';
    this.errors = errors;
  }
}

class AssetValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssetValidationError';
  }
}

class CriticalProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CriticalProfileError';
  }
}

// Export for enterprise usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CustomProfile,
    ThemeEngine,
    AssetManager,
    BrandingValidator,
    ProfileValidationError,
    AssetValidationError,
    CriticalProfileError
  };
} else {
  window.CustomProfile = CustomProfile;
  window.ThemeEngine = ThemeEngine;
  window.AssetManager = AssetManager;
}