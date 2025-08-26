/**
 * Enterprise Subscription Plans Configuration - PRODUCTION READY
 * Only real implemented features - NO MOCK DATA
 */

const PLAN_TYPES = {
  FREE: 'free',
  PLUS: 'plus', 
  PREMIUM: 'premium',
  ADVANCED: 'advanced'
};

const BILLING_INTERVALS = {
  MONTHLY: 'monthly',
  YEARLY: 'yearly'
};

// ONLY REAL IMPLEMENTED FEATURES - NO MOCK
const FEATURE_FLAGS = {
  // Core Features - IMPLEMENTED
  UNLIMITED_REVIEWS: 'unlimited_reviews',
  BASIC_PROFILE: 'basic_profile',
  RESPOND_TO_REVIEWS: 'respond_to_reviews',
  
  // Plus Features - IMPLEMENTED
  AUTO_REVIEW_INVITES: 'auto_review_invites',
  CUSTOM_PROFILE: 'custom_profile',
  
  // Premium Features - IMPLEMENTED
  ADVANCED_ANALYTICS: 'advanced_analytics',
  
  // Advanced Features - IMPLEMENTED  
  API_ACCESS: 'api_access'
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
      FEATURE_FLAGS.RESPOND_TO_REVIEWS
    ],
    
    limits: {
      reviewInvitesPerMonth: 0,
      apiRequestsPerMonth: 0,
      teamMembers: 1,
      dataRetentionMonths: 1,
      supportLevel: 'community'
    },
    
    restrictions: {
      brandingRemoval: false,
      prioritySupport: false,
      apiAccess: false
    }
  },
  
  {
    id: PLAN_TYPES.PLUS,
    name: 'Plus',
    displayName: 'Growth', 
    price: {
      monthly: 49,
      yearly: 490
    },
    currency: 'EUR',
    description: 'Essential features for growing businesses',
    tagline: 'Grow your reputation',
    popular: true,
    
    features: [
      FEATURE_FLAGS.UNLIMITED_REVIEWS,
      FEATURE_FLAGS.BASIC_PROFILE,
      FEATURE_FLAGS.RESPOND_TO_REVIEWS,
      FEATURE_FLAGS.AUTO_REVIEW_INVITES,
      FEATURE_FLAGS.CUSTOM_PROFILE
    ],
    
    limits: {
      reviewInvitesPerMonth: 200,
      apiRequestsPerMonth: 1000,
      teamMembers: 3,
      dataRetentionMonths: 6,
      supportLevel: 'email'
    },
    
    restrictions: {
      brandingRemoval: true,
      prioritySupport: false,
      apiAccess: false
    }
  },
  
  {
    id: PLAN_TYPES.PREMIUM,
    name: 'Premium',
    displayName: 'Professional',
    price: {
      monthly: 149,
      yearly: 1490
    },
    currency: 'EUR',
    description: 'Advanced features for professional businesses',
    tagline: 'Professional reputation management',
    popular: false,
    
    features: [
      FEATURE_FLAGS.UNLIMITED_REVIEWS,
      FEATURE_FLAGS.BASIC_PROFILE,
      FEATURE_FLAGS.RESPOND_TO_REVIEWS,
      FEATURE_FLAGS.AUTO_REVIEW_INVITES,
      FEATURE_FLAGS.CUSTOM_PROFILE,
      FEATURE_FLAGS.ADVANCED_ANALYTICS
    ],
    
    limits: {
      reviewInvitesPerMonth: 500,
      apiRequestsPerMonth: 10000,
      teamMembers: 10,
      dataRetentionMonths: 12,
      supportLevel: 'priority'
    },
    
    restrictions: {
      brandingRemoval: true,
      prioritySupport: true,
      apiAccess: 'limited'
    }
  },
  
  {
    id: PLAN_TYPES.ADVANCED,
    name: 'Advanced',
    displayName: 'Enterprise',
    price: {
      monthly: 399,
      yearly: 3990
    },
    currency: 'EUR',
    description: 'Full-featured solution for enterprises',
    tagline: 'Complete enterprise solution',
    popular: false,
    
    features: [
      FEATURE_FLAGS.UNLIMITED_REVIEWS,
      FEATURE_FLAGS.BASIC_PROFILE,
      FEATURE_FLAGS.RESPOND_TO_REVIEWS,
      FEATURE_FLAGS.AUTO_REVIEW_INVITES,
      FEATURE_FLAGS.CUSTOM_PROFILE,
      FEATURE_FLAGS.ADVANCED_ANALYTICS,
      FEATURE_FLAGS.API_ACCESS
    ],
    
    limits: {
      reviewInvitesPerMonth: 2500,
      apiRequestsPerMonth: 100000,
      teamMembers: 50,
      dataRetentionMonths: -1, // Unlimited
      supportLevel: 'dedicated'
    },
    
    restrictions: {
      brandingRemoval: true,
      prioritySupport: true,
      apiAccess: 'full'
    }
  }
];

/**
 * Plan comparison matrix for UI rendering - ONLY REAL FEATURES
 */
const planComparisonFeatures = [
  {
    category: 'Core Features',
    features: [
      { name: 'Review Collection', free: '✓', plus: '✓', premium: '✓', advanced: '✓' },
      { name: 'Review Invites/month', free: '0', plus: '200', premium: '500', advanced: '2,500' },
      { name: 'Team Members', free: '1', plus: '3', premium: '10', advanced: '50' },
      { name: 'API Access', free: '×', plus: '×', premium: 'Limited', advanced: 'Full' }
    ]
  },
  {
    category: 'Customization',
    features: [
      { name: 'Custom Profile', free: '×', plus: '✓', premium: '✓', advanced: '✓' },
      { name: 'Branding Removal', free: '×', plus: '✓', premium: '✓', advanced: '✓' }
    ]
  },
  {
    category: 'Analytics', 
    features: [
      { name: 'Basic Analytics', free: '×', plus: '×', premium: '✓', advanced: '✓' },
      { name: 'Advanced Analytics', free: '×', plus: '×', premium: '✓', advanced: '✓' }
    ]
  },
  {
    category: 'Support',
    features: [
      { name: 'Support Level', free: 'Community', plus: 'Email', premium: 'Priority', advanced: 'Dedicated' },
      { name: 'Response Time', free: '×', plus: '48h', premium: '24h', advanced: '4h' }
    ]
  }
];

module.exports = {
  PLAN_TYPES,
  BILLING_INTERVALS,
  FEATURE_FLAGS,
  subscriptionPlans,
  planComparisonFeatures,
  
  // Utility functions
  getPlanById: (planId) => subscriptionPlans.find(plan => plan.id === planId),
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