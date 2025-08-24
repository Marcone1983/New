/**
 * Enterprise Subscription Plans Configuration
 * Based on Trustpilot model with advanced enterprise features
 */

const PLAN_TYPES = {
  FREE: 'free',
  PLUS: 'plus', 
  PREMIUM: 'premium',
  ADVANCED: 'advanced',
  ENTERPRISE: 'enterprise'
};

const BILLING_INTERVALS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
  CUSTOM: 'custom'
};

const FEATURE_FLAGS = {
  // Core Features
  UNLIMITED_REVIEWS: 'unlimited_reviews',
  BASIC_PROFILE: 'basic_profile',
  RESPOND_TO_REVIEWS: 'respond_to_reviews',
  BASIC_WIDGETS: 'basic_widgets',
  
  // Plus Features
  AUTO_REVIEW_INVITES: 'auto_review_invites',
  CUSTOM_PROFILE: 'custom_profile',
  HIDE_COMPETITOR_ADS: 'hide_competitor_ads',
  ADVANCED_WIDGETS: 'advanced_widgets',
  ZENDESK_INTEGRATION: 'zendesk_integration',
  BASIC_ANALYTICS: 'basic_analytics',
  
  // Premium Features
  ADVANCED_REVIEW_MANAGEMENT: 'advanced_review_management',
  MARKETING_AUTOMATION: 'marketing_automation',
  CUSTOMER_SEGMENTATION: 'customer_segmentation',
  DETAILED_REPORTS: 'detailed_reports',
  DATA_EXPORT: 'data_export',
  
  // Advanced Features
  REVIEW_TAGGING: 'review_tagging',
  MARKET_INSIGHTS: 'market_insights',
  TRUSTSCORE_FORECASTING: 'trustscore_forecasting',
  SENTIMENT_ANALYSIS: 'sentiment_analysis',
  COMPETITOR_ANALYSIS: 'competitor_analysis',
  
  // Enterprise Features
  AI_AUTOMATED_RESPONSES: 'ai_automated_responses',
  PREDICTIVE_ANALYTICS: 'predictive_analytics',
  FULL_API_ACCESS: 'full_api_access',
  CUSTOM_INTEGRATIONS: 'custom_integrations',
  DEDICATED_SUPPORT: 'dedicated_support',
  SOC2_COMPLIANCE: 'soc2_compliance',
  
  // Future Monetization Features
  AI_SENTIMENT_DASHBOARD: 'ai_sentiment_dashboard',
  TOKENIZED_REWARDS: 'tokenized_rewards',
  VR_AR_REVIEWS: 'vr_ar_reviews',
  CHURN_PREDICTION: 'churn_prediction',
  GAMIFIED_LOYALTY: 'gamified_loyalty',
  MICRO_TIPPING: 'micro_tipping',
  INSIGHTS_MARKETPLACE: 'insights_marketplace',
  AI_VIDEO_REVIEWS: 'ai_video_reviews',
  WIDGET_MARKETPLACE: 'widget_marketplace',
  ETHICS_TRUST_BADGE: 'ethics_trust_badge'
};

const subscriptionPlans = [
  {
    id: PLAN_TYPES.FREE,
    name: 'Free',
    displayName: 'Starter',
    price: {
      monthly: 0,
      yearly: 0
    },
    currency: 'EUR',
    description: 'Perfect for getting started with online reputation management',
    tagline: 'Build trust, no strings attached',
    popular: false,
    
    features: [
      FEATURE_FLAGS.UNLIMITED_REVIEWS,
      FEATURE_FLAGS.BASIC_PROFILE,
      FEATURE_FLAGS.RESPOND_TO_REVIEWS,
      FEATURE_FLAGS.BASIC_WIDGETS
    ],
    
    limits: {
      reviewInvitesPerMonth: 50,
      apiRequestsPerMonth: 1000,
      teamMembers: 1,
      customDomains: 0,
      dataRetentionMonths: 12,
      supportLevel: 'community'
    },
    
    restrictions: {
      brandingRemoval: false,
      advancedCustomization: false,
      prioritySupport: false,
      apiAccess: false
    }
  },
  
  {
    id: PLAN_TYPES.PLUS,
    name: 'Plus',
    displayName: 'Growth', 
    price: {
      monthly: 99,
      yearly: 990 // 2 months free
    },
    currency: 'EUR',
    description: 'Accelerate your reputation building with automation and insights',
    tagline: 'Grow faster with smart automation',
    popular: true,
    
    features: [
      ...subscriptionPlans[0].features,
      FEATURE_FLAGS.AUTO_REVIEW_INVITES,
      FEATURE_FLAGS.CUSTOM_PROFILE,
      FEATURE_FLAGS.HIDE_COMPETITOR_ADS,
      FEATURE_FLAGS.ADVANCED_WIDGETS,
      FEATURE_FLAGS.ZENDESK_INTEGRATION,
      FEATURE_FLAGS.BASIC_ANALYTICS
    ],
    
    limits: {
      reviewInvitesPerMonth: 200,
      apiRequestsPerMonth: 5000,
      teamMembers: 3,
      customDomains: 1,
      dataRetentionMonths: 24,
      supportLevel: 'email'
    },
    
    restrictions: {
      brandingRemoval: true,
      advancedCustomization: false,
      prioritySupport: false,
      apiAccess: 'limited'
    },
    
    // Stripe Price IDs
    stripePriceIds: {
      monthly: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PLUS_YEARLY_PRICE_ID
    }
  },
  
  {
    id: PLAN_TYPES.PREMIUM,
    name: 'Premium',
    displayName: 'Professional',
    price: {
      monthly: 249,
      yearly: 2490 // 2 months free
    },
    currency: 'EUR',
    description: 'Advanced automation and analytics for professional reputation management',
    tagline: 'Professional tools for serious growth',
    popular: false,
    
    features: [
      ...subscriptionPlans[1].features,
      FEATURE_FLAGS.ADVANCED_REVIEW_MANAGEMENT,
      FEATURE_FLAGS.MARKETING_AUTOMATION,
      FEATURE_FLAGS.CUSTOMER_SEGMENTATION,
      FEATURE_FLAGS.DETAILED_REPORTS,
      FEATURE_FLAGS.DATA_EXPORT
    ],
    
    limits: {
      reviewInvitesPerMonth: 1000,
      apiRequestsPerMonth: 20000,
      teamMembers: 10,
      customDomains: 3,
      dataRetentionMonths: 36,
      supportLevel: 'priority'
    },
    
    restrictions: {
      brandingRemoval: true,
      advancedCustomization: true,
      prioritySupport: true,
      apiAccess: 'standard'
    },
    
    stripePriceIds: {
      monthly: process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID
    }
  },
  
  {
    id: PLAN_TYPES.ADVANCED,
    name: 'Advanced',
    displayName: 'Enterprise Ready',
    price: {
      monthly: 499,
      yearly: 4990 // 2 months free
    },
    currency: 'EUR',
    description: 'Market intelligence and predictive analytics for competitive advantage',
    tagline: 'Stay ahead of the competition',
    popular: false,
    
    features: [
      ...subscriptionPlans[2].features,
      FEATURE_FLAGS.REVIEW_TAGGING,
      FEATURE_FLAGS.MARKET_INSIGHTS,
      FEATURE_FLAGS.TRUSTSCORE_FORECASTING,
      FEATURE_FLAGS.SENTIMENT_ANALYSIS,
      FEATURE_FLAGS.COMPETITOR_ANALYSIS
    ],
    
    limits: {
      reviewInvitesPerMonth: 5000,
      apiRequestsPerMonth: 50000,
      teamMembers: 25,
      customDomains: 10,
      dataRetentionMonths: 60,
      supportLevel: 'dedicated'
    },
    
    restrictions: {
      brandingRemoval: true,
      advancedCustomization: true,
      prioritySupport: true,
      apiAccess: 'full'
    },
    
    stripePriceIds: {
      monthly: process.env.STRIPE_ADVANCED_MONTHLY_PRICE_ID,
      yearly: process.env.STRIPE_ADVANCED_YEARLY_PRICE_ID
    }
  },
  
  {
    id: PLAN_TYPES.ENTERPRISE,
    name: 'Enterprise',
    displayName: 'Custom Solution',
    price: {
      monthly: null,
      yearly: null,
      custom: 'Contact Sales'
    },
    currency: 'EUR',
    description: 'Fully customizable enterprise solution with AI and dedicated support',
    tagline: 'Built for enterprise scale',
    popular: false,
    
    features: [
      ...subscriptionPlans[3].features,
      FEATURE_FLAGS.AI_AUTOMATED_RESPONSES,
      FEATURE_FLAGS.PREDICTIVE_ANALYTICS,
      FEATURE_FLAGS.FULL_API_ACCESS,
      FEATURE_FLAGS.CUSTOM_INTEGRATIONS,
      FEATURE_FLAGS.DEDICATED_SUPPORT,
      FEATURE_FLAGS.SOC2_COMPLIANCE
    ],
    
    limits: {
      reviewInvitesPerMonth: Infinity,
      apiRequestsPerMonth: Infinity,
      teamMembers: Infinity,
      customDomains: Infinity,
      dataRetentionMonths: Infinity,
      supportLevel: 'white_glove'
    },
    
    restrictions: {
      brandingRemoval: true,
      advancedCustomization: true,
      prioritySupport: true,
      apiAccess: 'unlimited'
    },
    
    // Enterprise pricing is custom - handled separately
    customPricing: true
  }
];

/**
 * Future Monetization Modules
 * Advanced features for competitive differentiation
 */
const futureMonetizationModules = [
  {
    id: 'ai_sentiment_dashboard',
    name: 'AI Sentiment Dashboard',
    category: 'analytics',
    description: 'Real-time sentiment analysis with predictive alerts and automated action recommendations',
    pricing: {
      type: 'usage',
      basePrice: 49,
      perAnalysis: 0.10,
      includedAnalyses: 500
    },
    requiredPlan: PLAN_TYPES.PREMIUM,
    features: [
      'Real-time sentiment scoring',
      'Predictive crisis alerts', 
      'Automated response suggestions',
      'Sentiment trend forecasting',
      'Multi-language support'
    ]
  },
  
  {
    id: 'tokenized_rewards',
    name: 'Blockchain Loyalty Program',
    category: 'engagement',
    description: 'NFT-based rewards system with tradeable tokens for top reviewers',
    pricing: {
      type: 'subscription',
      monthlyPrice: 199,
      setupFee: 999,
      transactionFee: 0.05
    },
    requiredPlan: PLAN_TYPES.ADVANCED,
    features: [
      'Custom ERC-721 NFT creation',
      'Token marketplace integration',
      'Smart contract management',
      'Gamified earning mechanics',
      'Cross-platform token utility'
    ]
  },
  
  {
    id: 'vr_ar_reviews', 
    name: 'Immersive Review Experience',
    category: 'innovation',
    description: 'VR/AR visualization of business locations and products within review context',
    pricing: {
      type: 'credits',
      creditPrice: 2.99,
      monthlySubscription: 299,
      includedCredits: 200
    },
    requiredPlan: PLAN_TYPES.ADVANCED,
    features: [
      '360° business tours',
      'AR product overlay',
      'Virtual showroom creation',
      'Mobile AR viewer',
      'WebXR compatibility'
    ]
  },
  
  {
    id: 'churn_prediction',
    name: 'Customer Churn AI',
    category: 'analytics', 
    description: 'ML-powered customer churn prediction with intervention recommendations',
    pricing: {
      type: 'tiered',
      tiers: [
        { customers: 1000, price: 149 },
        { customers: 5000, price: 499 },
        { customers: 25000, price: 1299 }
      ]
    },
    requiredPlan: PLAN_TYPES.PREMIUM,
    features: [
      'Churn probability scoring',
      'Risk factor identification',
      'Automated intervention campaigns',
      'ROI impact measurement',
      'CRM integration'
    ]
  },
  
  {
    id: 'gamified_loyalty',
    name: 'Enterprise Gamification',
    category: 'engagement',
    description: 'Comprehensive gamification system with levels, badges, and exclusive rewards',
    pricing: {
      type: 'subscription',
      monthlyPrice: 99,
      per1000Users: 29,
      setupFee: 499
    },
    requiredPlan: PLAN_TYPES.PLUS,
    features: [
      'Custom badge design system',
      'Leaderboard management',
      'Achievement tracking',
      'Reward marketplace',
      'Social sharing integration'
    ]
  }
];

/**
 * Plan comparison matrix for UI rendering
 */
const planComparisonFeatures = [
  {
    category: 'Core Features',
    features: [
      { name: 'Review Collection', free: '✓', plus: '✓', premium: '✓', advanced: '✓', enterprise: '✓' },
      { name: 'Review Invites/month', free: '50', plus: '200', premium: '1,000', advanced: '5,000', enterprise: 'Unlimited' },
      { name: 'Team Members', free: '1', plus: '3', premium: '10', advanced: '25', enterprise: 'Unlimited' },
      { name: 'API Access', free: '×', plus: 'Limited', premium: 'Standard', advanced: 'Full', enterprise: 'Unlimited' }
    ]
  },
  {
    category: 'Customization',
    features: [
      { name: 'Custom Branding', free: '×', plus: '✓', premium: '✓', advanced: '✓', enterprise: '✓' },
      { name: 'White Label', free: '×', plus: '×', premium: '×', advanced: 'Limited', enterprise: '✓' },
      { name: 'Custom Domains', free: '0', plus: '1', premium: '3', advanced: '10', enterprise: 'Unlimited' }
    ]
  },
  {
    category: 'Analytics & Insights', 
    features: [
      { name: 'Basic Analytics', free: '×', plus: '✓', premium: '✓', advanced: '✓', enterprise: '✓' },
      { name: 'Advanced Reports', free: '×', plus: '×', premium: '✓', advanced: '✓', enterprise: '✓' },
      { name: 'Predictive Analytics', free: '×', plus: '×', premium: '×', advanced: '×', enterprise: '✓' },
      { name: 'Market Intelligence', free: '×', plus: '×', premium: '×', advanced: '✓', enterprise: '✓' }
    ]
  },
  {
    category: 'Support',
    features: [
      { name: 'Support Level', free: 'Community', plus: 'Email', premium: 'Priority', advanced: 'Dedicated', enterprise: 'White Glove' },
      { name: 'SLA', free: '×', plus: '×', premium: '24h', advanced: '4h', enterprise: '1h' },
      { name: 'Account Manager', free: '×', plus: '×', premium: '×', advanced: '×', enterprise: '✓' }
    ]
  }
];

module.exports = {
  PLAN_TYPES,
  BILLING_INTERVALS,
  FEATURE_FLAGS,
  subscriptionPlans,
  futureMonetizationModules,
  planComparisonFeatures,
  
  // Utility functions
  getPlanById: (planId) => subscriptionPlans.find(plan => plan.id === planId),
  getMonetizationModuleById: (moduleId) => futureMonetizationModules.find(module => module.id === moduleId),
  getPlanFeatures: (planId) => {
    const plan = subscriptionPlans.find(p => p.id === planId);
    return plan ? plan.features : [];
  },
  isPlanFeatureEnabled: (planId, feature) => {
    const planFeatures = module.exports.getPlanFeatures(planId);
    return planFeatures.includes(feature);
  },
  getUpgradeablePlans: (currentPlanId) => {
    const currentPlanIndex = subscriptionPlans.findIndex(p => p.id === currentPlanId);
    return subscriptionPlans.slice(currentPlanIndex + 1);
  }
};