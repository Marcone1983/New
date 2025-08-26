/**
 * REVIEW TAGGING ADVANCED - Organizza feedback per topic
 * Enterprise-grade review categorization and tagging system with NLP processing,
 * machine learning topic detection, and intelligent classification engine
 * Architecture: Strategy + Observer + Factory + Command patterns
 */

class ReviewTagging {
  constructor(dbAPI, businessId, plan = 'premium') {
    this.dbAPI = dbAPI;
    this.businessId = businessId;
    this.plan = plan;
    
    // Enterprise Tagging Architecture
    this.nlpProcessor = new NLPProcessor();
    this.topicDetector = new TopicDetectionEngine();
    this.sentimentAnalyzer = new SentimentAnalyzer();
    this.tagHierarchyManager = new TagHierarchyManager(businessId);
    this.autoTaggingEngine = new AutoTaggingEngine();
    this.classificationEngine = new ClassificationEngine();
    
    // Machine Learning Components
    this.mlModelManager = new MLModelManager(businessId);
    this.featureExtractor = new FeatureExtractor();
    this.trainingDataManager = new TrainingDataManager(businessId);
    this.modelEvaluator = new ModelEvaluator();
    
    // Performance and Analytics
    this.taggingAnalytics = new TaggingAnalytics(businessId);
    this.performanceTracker = new TaggingPerformanceTracker();
    this.qualityAssurance = new TaggingQualityAssurance();
    
    // Event System
    this.eventBus = new TaggingEventBus();
    this.rulesEngine = new TaggingRulesEngine();
    
    this.initializeTaggingSystem();
  }

  // Initialize enterprise tagging components
  initializeTaggingSystem() {
    // Initialize NLP processing pipeline
    this.initializeNLPPipeline();
    
    // Setup topic detection models
    this.initializeTopicDetection();
    
    // Configure auto-tagging rules
    this.initializeAutoTaggingRules();
    
    // Setup tag hierarchy and taxonomy
    this.initializeTagHierarchy();
    
    // Configure machine learning models
    this.initializeMLModels();
    
    // Setup event listeners for reactive tagging
    this.setupEventListeners();
  }

  // Initialize NLP processing pipeline
  initializeNLPPipeline() {
    const pipeline = new NLPPipeline()
      .addStage(new TextNormalizationStage())
      .addStage(new TokenizationStage())
      .addStage(new POSTaggingStage())
      .addStage(new NERStage()) // Named Entity Recognition
      .addStage(new SentimentExtractionStage())
      .addStage(new KeywordExtractionStage())
      .addStage(new TopicModelingStage());

    this.nlpProcessor.setPipeline(pipeline);
  }

  // Initialize topic detection with domain-specific models
  initializeTopicDetection() {
    const topicModels = [
      new ServiceQualityTopicModel(),
      new ProductFeaturesTopicModel(), 
      new CustomerServiceTopicModel(),
      new PricingTopicModel(),
      new DeliveryTopicModel(),
      new UserExperienceTopicModel(),
      new TechnicalIssuesTopicModel(),
      new CompetitorMentionsTopicModel()
    ];

    topicModels.forEach(model => {
      this.topicDetector.registerModel(model);
    });
  }

  // Process and tag a single review with advanced analysis
  async processReviewForTagging(reviewId, options = {}) {
    const startTime = performance.now();
    
    try {
      // Load review data
      const review = await this.loadReview(reviewId);
      if (!review) {
        throw new Error('Review not found');
      }

      // Skip if already processed and not forced
      if (review.tags && review.tags.length > 0 && !options.forceReprocess) {
        return {
          success: true,
          reviewId: reviewId,
          existingTags: review.tags,
          source: 'cache'
        };
      }

      // Create processing context
      const processingContext = new ReviewProcessingContext({
        reviewId: reviewId,
        businessId: this.businessId,
        language: options.language || 'it',
        processingMode: options.mode || 'comprehensive',
        confidenceThreshold: options.confidenceThreshold || 0.7
      });

      // Execute NLP processing pipeline
      const nlpResult = await this.nlpProcessor.process(review.text, processingContext);
      
      if (!nlpResult.success) {
        throw new NLPProcessingError('NLP processing failed', nlpResult.errors);
      }

      // Extract topics using machine learning models
      const topicResult = await this.topicDetector.detectTopics(review.text, nlpResult.features);
      
      // Perform sentiment analysis at topic level
      const sentimentResult = await this.sentimentAnalyzer.analyzeTopicSentiments(
        review.text, 
        topicResult.topics
      );

      // Apply auto-tagging rules
      const autoTagsResult = await this.autoTaggingEngine.generateTags({
        review: review,
        nlpFeatures: nlpResult.features,
        topics: topicResult.topics,
        sentiments: sentimentResult.sentiments,
        context: processingContext
      });

      // Classify review using trained models
      const classificationResult = await this.classificationEngine.classifyReview(
        review,
        nlpResult.features
      );

      // Merge and prioritize tags from different sources
      const mergedTags = await this.mergeAndPrioritizeTags({
        autoTags: autoTagsResult.tags,
        topicTags: topicResult.tags,
        classificationTags: classificationResult.tags,
        sentimentTags: sentimentResult.tags
      });

      // Validate tags against business rules and hierarchy
      const validatedTags = await this.validateAndNormalizeTags(mergedTags, processingContext);

      // Apply tag hierarchy and relationships
      const hierarchicalTags = await this.tagHierarchyManager.applyHierarchy(validatedTags);

      // Save processed tags to database
      const saveResult = await this.saveReviewTags(reviewId, hierarchicalTags, {
        processingMetadata: {
          nlpFeatures: nlpResult.features,
          topics: topicResult.topics,
          sentiments: sentimentResult.sentiments,
          confidence: this.calculateOverallConfidence(hierarchicalTags),
          processingTime: performance.now() - startTime,
          processingDate: new Date().toISOString()
        }
      });

      if (saveResult.success) {
        // Update analytics and metrics
        await this.taggingAnalytics.recordTagging(reviewId, hierarchicalTags);
        
        // Trigger downstream processes
        this.eventBus.emit('review.tagged', {
          reviewId: reviewId,
          businessId: this.businessId,
          tags: hierarchicalTags,
          confidence: this.calculateOverallConfidence(hierarchicalTags)
        });

        // Update ML model training data if high confidence
        if (this.calculateOverallConfidence(hierarchicalTags) > 0.85) {
          await this.trainingDataManager.addTrainingExample(review, hierarchicalTags);
        }

        const processingTime = performance.now() - startTime;

        return {
          success: true,
          reviewId: reviewId,
          tags: hierarchicalTags,
          metadata: {
            topicsDetected: topicResult.topics.length,
            sentimentsAnalyzed: sentimentResult.sentiments.length,
            autoTagsGenerated: autoTagsResult.tags.length,
            finalTagsCount: hierarchicalTags.length,
            processingTime: Math.round(processingTime),
            confidence: this.calculateOverallConfidence(hierarchicalTags)
          }
        };
      } else {
        throw new Error(`Failed to save tags: ${saveResult.error}`);
      }

    } catch (error) {
      await this.handleTaggingError(error, reviewId);
      
      return {
        success: false,
        reviewId: reviewId,
        error: error.message,
        errorType: error.constructor.name,
        processingTime: performance.now() - startTime
      };
    }
  }

  // Batch process multiple reviews for tagging
  async processReviewsBatch(reviewIds, options = {}) {
    const batchStartTime = performance.now();
    const batchSize = options.batchSize || 50;
    const results = [];
    
    try {
      // Process reviews in batches to manage memory and performance
      for (let i = 0; i < reviewIds.length; i += batchSize) {
        const batch = reviewIds.slice(i, i + batchSize);
        
        const batchPromises = batch.map(reviewId => 
          this.processReviewForTagging(reviewId, options)
        );

        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
          const reviewId = batch[index];
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            results.push({
              success: false,
              reviewId: reviewId,
              error: result.reason.message
            });
          }
        });

        // Small delay between batches to prevent system overload
        if (i + batchSize < reviewIds.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Generate batch processing report
      const batchReport = this.generateBatchProcessingReport(results, batchStartTime);
      
      // Update batch processing metrics
      await this.performanceTracker.recordBatchProcessing(batchReport);

      return {
        success: true,
        totalProcessed: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results: results,
        batchReport: batchReport
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        totalProcessed: results.length,
        results: results
      };
    }
  }

  // Create and manage tag taxonomy
  async createTagTaxonomy(taxonomyConfig) {
    try {
      const taxonomy = new TagTaxonomy()
        .setBusinessId(this.businessId)
        .setName(taxonomyConfig.name)
        .setDescription(taxonomyConfig.description)
        .setVersion(taxonomyConfig.version || '1.0');

      // Build hierarchy structure
      const hierarchyBuilder = new TagHierarchyBuilder();
      
      for (const category of taxonomyConfig.categories) {
        const categoryNode = hierarchyBuilder
          .createCategory(category.name, category.description)
          .setParent(category.parent)
          .setPriority(category.priority);

        // Add subcategories
        if (category.subcategories) {
          for (const subcategory of category.subcategories) {
            categoryNode.addSubcategory(
              subcategory.name,
              subcategory.description,
              subcategory.keywords || []
            );
          }
        }

        taxonomy.addCategory(categoryNode);
      }

      // Validate taxonomy structure
      const validation = await this.validateTaxonomy(taxonomy);
      if (!validation.isValid) {
        throw new TaxonomyValidationError('Invalid taxonomy structure', validation.errors);
      }

      // Save taxonomy to database
      const saveResult = await this.saveTaxonomy(taxonomy);
      
      if (saveResult.success) {
        // Update tag hierarchy manager
        await this.tagHierarchyManager.loadTaxonomy(taxonomy);
        
        // Retrain classification models with new taxonomy
        await this.mlModelManager.retrainWithTaxonomy(taxonomy);
        
        return {
          success: true,
          taxonomyId: taxonomy.id,
          taxonomy: taxonomy,
          categoriesCount: taxonomy.categories.length,
          totalTags: taxonomy.getTotalTagsCount()
        };
      } else {
        throw new Error(`Taxonomy save failed: ${saveResult.error}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
  }

  // Advanced tag search and filtering
  async searchReviewsByTags(searchConfig) {
    try {
      const searchEngine = new TagSearchEngine(this.dbAPI);
      
      const searchQuery = new TagSearchQuery()
        .setBusinessId(this.businessId)
        .setTags(searchConfig.tags || [])
        .setTagLogic(searchConfig.logic || 'AND') // AND, OR, NOT
        .setTimeRange(searchConfig.timeRange)
        .setPlatforms(searchConfig.platforms)
        .setSentimentFilter(searchConfig.sentimentFilter)
        .setRatingRange(searchConfig.ratingRange)
        .setSortBy(searchConfig.sortBy || 'relevance')
        .setLimit(searchConfig.limit || 100)
        .setOffset(searchConfig.offset || 0);

      // Add advanced filters
      if (searchConfig.advancedFilters) {
        searchQuery.setAdvancedFilters(searchConfig.advancedFilters);
      }

      // Execute search with relevance scoring
      const searchResult = await searchEngine.executeSearch(searchQuery);
      
      if (searchResult.success) {
        // Calculate search analytics
        const searchAnalytics = await this.calculateSearchAnalytics(searchResult.results);
        
        return {
          success: true,
          results: searchResult.results,
          totalCount: searchResult.totalCount,
          searchTime: searchResult.executionTime,
          analytics: searchAnalytics,
          facets: searchResult.facets, // For filtering UI
          suggestions: await this.generateSearchSuggestions(searchConfig.tags)
        };
      } else {
        throw new Error(`Search execution failed: ${searchResult.error}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
  }

  // Generate tag insights and analytics
  async generateTagInsights(insightsConfig = {}) {
    try {
      const timeRange = insightsConfig.timeRange || '30d';
      const includeComparisons = insightsConfig.includeComparisons !== false;
      const includeForecasts = insightsConfig.includeForecasts !== false;
      
      // Get tag performance data
      const tagPerformance = await this.taggingAnalytics.getTagPerformance(
        this.businessId, 
        timeRange
      );

      // Calculate tag trends
      const tagTrends = await this.taggingAnalytics.calculateTagTrends(
        this.businessId,
        timeRange
      );

      // Identify emerging topics
      const emergingTopics = await this.identifyEmergingTopics(tagPerformance, tagTrends);
      
      // Calculate sentiment trends by tag
      const sentimentTrendsByTag = await this.calculateSentimentTrendsByTag(timeRange);
      
      // Generate correlations between tags
      const tagCorrelations = await this.calculateTagCorrelations(tagPerformance);
      
      // Identify improvement opportunities
      const improvementOpportunities = await this.identifyImprovementOpportunities(
        tagPerformance,
        sentimentTrendsByTag
      );

      const insights = {
        summary: {
          totalTags: tagPerformance.totalTags,
          activeTopics: tagPerformance.activeTopics,
          avgSentimentScore: tagPerformance.avgSentimentScore,
          tagsGrowthRate: tagTrends.overallGrowthRate
        },
        
        topPerformingTags: tagPerformance.topTags,
        underperformingTags: tagPerformance.bottomTags,
        emergingTopics: emergingTopics,
        
        trends: {
          tagUsageTrends: tagTrends.usageTrends,
          sentimentTrends: sentimentTrendsByTag,
          seasonalPatterns: tagTrends.seasonalPatterns
        },
        
        correlations: tagCorrelations,
        opportunities: improvementOpportunities
      };

      // Add forecasts if requested
      if (includeForecasts && this.plan === 'advanced') {
        insights.forecasts = await this.generateTagForecasts(tagPerformance, tagTrends);
      }

      // Add competitive comparisons if available
      if (includeComparisons && this.plan === 'advanced') {
        insights.benchmarks = await this.generateTagBenchmarks(tagPerformance);
      }

      return {
        success: true,
        insights: insights,
        generatedAt: new Date().toISOString(),
        dataRange: timeRange
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
  }

  // Configure auto-tagging rules
  async createAutoTaggingRule(ruleConfig) {
    try {
      const rule = new AutoTaggingRule()
        .setName(ruleConfig.name)
        .setDescription(ruleConfig.description)
        .setBusinessId(this.businessId)
        .setPriority(ruleConfig.priority || 100)
        .setActive(ruleConfig.active !== false);

      // Add conditions
      for (const condition of ruleConfig.conditions) {
        const conditionObj = AutoTaggingConditionFactory.create(condition.type, condition.config);
        rule.addCondition(conditionObj);
      }

      // Add actions (tags to apply)
      for (const action of ruleConfig.actions) {
        const actionObj = new ApplyTagAction(action.tagId, action.confidence);
        rule.addAction(actionObj);
      }

      // Validate rule logic
      const validation = await this.validateAutoTaggingRule(rule);
      if (!validation.isValid) {
        throw new RuleValidationError('Invalid auto-tagging rule', validation.errors);
      }

      // Save rule to database
      const saveResult = await this.saveAutoTaggingRule(rule);
      
      if (saveResult.success) {
        // Register rule with auto-tagging engine
        this.autoTaggingEngine.registerRule(rule);
        
        // Test rule against sample data
        const testResults = await this.testAutoTaggingRule(rule, ruleConfig.testSamples || []);
        
        return {
          success: true,
          ruleId: rule.id,
          rule: rule,
          testResults: testResults,
          estimatedImpact: testResults.estimatedApplicableReviews
        };
      } else {
        throw new Error(`Rule save failed: ${saveResult.error}`);
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
  }

  // Train and improve ML models
  async trainTaggingModels(trainingConfig = {}) {
    try {
      const modelTrainer = new TaggingModelTrainer();
      
      // Get training data
      const trainingData = await this.trainingDataManager.getTrainingData({
        businessId: this.businessId,
        minConfidence: trainingConfig.minConfidence || 0.8,
        maxAge: trainingConfig.maxAge || '90d',
        balanceDataset: trainingConfig.balanceDataset !== false
      });

      if (trainingData.samples.length < 100) {
        throw new InsufficientDataError('Insufficient training data for model training');
      }

      // Split data for training and validation
      const { trainSet, validationSet, testSet } = modelTrainer.splitData(
        trainingData.samples,
        trainingConfig.splitRatio || [0.7, 0.15, 0.15]
      );

      // Train topic detection model
      const topicModelResult = await modelTrainer.trainTopicModel(trainSet, {
        topics: trainingConfig.topicsCount || 20,
        iterations: trainingConfig.iterations || 1000,
        alpha: trainingConfig.alpha || 0.1
      });

      // Train classification model
      const classificationModelResult = await modelTrainer.trainClassificationModel(trainSet, {
        algorithm: trainingConfig.algorithm || 'random_forest',
        features: trainingConfig.features || 'auto',
        crossValidation: trainingConfig.crossValidation !== false
      });

      // Evaluate models
      const topicModelEvaluation = await this.modelEvaluator.evaluateTopicModel(
        topicModelResult.model,
        testSet
      );

      const classificationModelEvaluation = await this.modelEvaluator.evaluateClassificationModel(
        classificationModelResult.model,
        testSet
      );

      // Deploy models if performance is acceptable
      let deploymentResults = {};
      
      if (topicModelEvaluation.coherenceScore > 0.7) {
        deploymentResults.topicModel = await this.mlModelManager.deployModel(
          'topic_detection',
          topicModelResult.model
        );
      }

      if (classificationModelEvaluation.accuracy > 0.85) {
        deploymentResults.classificationModel = await this.mlModelManager.deployModel(
          'classification',
          classificationModelResult.model
        );
      }

      return {
        success: true,
        training: {
          samplesUsed: trainingData.samples.length,
          trainingSamples: trainSet.length,
          validationSamples: validationSet.length,
          testSamples: testSet.length
        },
        models: {
          topicModel: {
            trained: true,
            evaluation: topicModelEvaluation,
            deployed: deploymentResults.topicModel?.success || false
          },
          classificationModel: {
            trained: true,
            evaluation: classificationModelEvaluation,
            deployed: deploymentResults.classificationModel?.success || false
          }
        },
        nextRetrainingRecommended: this.calculateNextRetrainingDate(trainingData.samples.length)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      };
    }
  }

  // Merge and prioritize tags from different sources
  async mergeAndPrioritizeTags(tagSources) {
    const allTags = [];
    const tagConfidenceMap = new Map();

    // Collect all tags with their sources and confidence scores
    Object.entries(tagSources).forEach(([source, tags]) => {
      tags.forEach(tag => {
        const tagKey = tag.name.toLowerCase();
        
        if (tagConfidenceMap.has(tagKey)) {
          // Merge confidence scores using weighted average
          const existing = tagConfidenceMap.get(tagKey);
          const newConfidence = this.calculateMergedConfidence(existing.confidence, tag.confidence, source);
          
          tagConfidenceMap.set(tagKey, {
            name: tag.name,
            confidence: newConfidence,
            sources: [...existing.sources, source],
            metadata: { ...existing.metadata, ...tag.metadata }
          });
        } else {
          tagConfidenceMap.set(tagKey, {
            name: tag.name,
            confidence: tag.confidence,
            sources: [source],
            metadata: tag.metadata || {}
          });
        }
      });
    });

    // Convert to array and sort by confidence
    const mergedTags = Array.from(tagConfidenceMap.values())
      .filter(tag => tag.confidence >= 0.5) // Minimum confidence threshold
      .sort((a, b) => b.confidence - a.confidence);

    return mergedTags;
  }

  // Setup event listeners for reactive tagging
  setupEventListeners() {
    this.eventBus.subscribe('review.created', this.handleNewReview.bind(this));
    this.eventBus.subscribe('review.updated', this.handleUpdatedReview.bind(this));
    this.eventBus.subscribe('taxonomy.updated', this.handleTaxonomyUpdate.bind(this));
    this.eventBus.subscribe('rule.created', this.handleNewTaggingRule.bind(this));
  }

  // Event handlers
  async handleNewReview(event) {
    const { reviewId, businessId } = event.data;
    if (businessId !== this.businessId) return;

    // Auto-process new reviews for tagging
    await this.processReviewForTagging(reviewId, { mode: 'auto' });
  }

  async handleTaxonomyUpdate(event) {
    const { businessId } = event.data;
    if (businessId !== this.businessId) return;

    // Retrain models with updated taxonomy
    await this.trainTaggingModels({ reason: 'taxonomy_update' });
  }

  // Get tagging system performance metrics
  getTaggingStats() {
    return {
      feature: 'Review Tagging Advanced',
      status: 'active',
      plan: this.plan,
      modelsActive: this.mlModelManager.getActiveModelsCount(),
      rulesActive: this.autoTaggingEngine.getActiveRulesCount(),
      taxonomyVersion: this.tagHierarchyManager.getTaxonomyVersion(),
      lastModelUpdate: this.mlModelManager.getLastUpdateDate()
    };
  }
}

// Supporting Classes

class NLPPipeline {
  constructor() {
    this.stages = [];
  }

  addStage(stage) {
    this.stages.push(stage);
    return this;
  }

  async process(text, context) {
    let features = { originalText: text };
    
    for (const stage of this.stages) {
      try {
        features = await stage.process(features, context);
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stage: stage.getName()
        };
      }
    }
    
    return {
      success: true,
      features: features
    };
  }
}

class TagTaxonomy {
  constructor() {
    this.id = null;
    this.businessId = null;
    this.name = '';
    this.description = '';
    this.version = '1.0';
    this.categories = [];
    this.createdAt = new Date().toISOString();
  }

  setBusinessId(businessId) {
    this.businessId = businessId;
    return this;
  }

  setName(name) {
    this.name = name;
    return this;
  }

  setDescription(description) {
    this.description = description;
    return this;
  }

  setVersion(version) {
    this.version = version;
    return this;
  }

  addCategory(category) {
    this.categories.push(category);
    return this;
  }

  getTotalTagsCount() {
    return this.categories.reduce((total, category) => {
      return total + category.getTagsCount();
    }, 0);
  }
}

// Custom Error Classes
class NLPProcessingError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'NLPProcessingError';
    this.errors = errors;
  }
}

class TaxonomyValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'TaxonomyValidationError';
    this.errors = errors;
  }
}

class RuleValidationError extends Error {
  constructor(message, errors) {
    super(message);
    this.name = 'RuleValidationError';
    this.errors = errors;
  }
}

class InsufficientDataError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InsufficientDataError';
  }
}

// Export for enterprise usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ReviewTagging,
    TagTaxonomy,
    NLPPipeline,
    NLPProcessingError,
    TaxonomyValidationError,
    RuleValidationError,
    InsufficientDataError
  };
} else {
  window.ReviewTagging = ReviewTagging;
}