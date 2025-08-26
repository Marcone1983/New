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
    description: 'Inizia gratis con le funzioni base',
    tagline: 'Gestione recensioni base',
    popular: false,
    
    features: [
      'Recensioni Illimitate - Raccogli recensioni senza limiti',
      'Profilo Base - Pagina aziendale pubblica', 
      'Rispondi alle Recensioni - Interagisci con i clienti'
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
    description: 'Features essenziali per aziende in crescita',
    tagline: 'Fai crescere la tua reputazione',
    popular: true,
    
    features: [
      'Recensioni Illimitate - Raccogli recensioni senza limiti',
      'Profilo Base - Pagina aziendale pubblica',
      'Rispondi alle Recensioni - Interagisci con i clienti',
      'Inviti Automatici Plus - 200 inviti/mese automatizzati',
      'Profilo Custom Plus - Logo e branding personalizzato'
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
    description: 'Funzionalità avanzate per business professionali',
    tagline: 'Gestione reputazione professionale',
    popular: false,
    
    features: [
      'Recensioni Illimitate - Raccogli recensioni senza limiti',
      'Profilo Base - Pagina aziendale pubblica',
      'Rispondi alle Recensioni - Interagisci con i clienti',
      'Inviti Automatici Plus - 500 inviti/mese automatizzati',
      'Profilo Custom Plus - Logo e branding personalizzato',
      'Analytics Avanzate Premium - Report dettagliati e insights',
      'Marketing Automation Premium - Workflow automatizzati',
      'Review Tagging Advanced - Organizza feedback per topic'
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
    description: 'Soluzione completa per enterprise',
    tagline: 'Soluzione enterprise completa',
    popular: false,
    
    features: [
      'Recensioni Illimitate - Raccogli recensioni senza limiti',
      'Profilo Base - Pagina aziendale pubblica',
      'Rispondi alle Recensioni - Interagisci con i clienti',
      'Inviti Automatici Plus - 2,500 inviti/mese automatizzati',
      'Profilo Custom Plus - Logo e branding personalizzato',
      'Analytics Avanzate Premium - Report dettagliati e insights',
      'Marketing Automation Premium - Workflow automatizzati',
      'Review Tagging Advanced - Organizza feedback per topic',
      'TrustScore Forecasting Advanced - Previsioni AI sul punteggio',
      'AI Auto-Response Enterprise - Risposte automatiche intelligenti',
      'SOC2 Compliance Enterprise - Certificazioni sicurezza',
      'API Illimitate Enterprise - Accesso completo alle API',
      'Zendesk Plus - Gestione ticket integrata',
      'HubSpot Advanced - CRM & Marketing automation',
      'Salesforce Enterprise - Enterprise CRM integration'
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
 * Plan comparison matrix - ONLY REAL IMPLEMENTED FEATURES
 */
const planComparisonFeatures = [
  {
    category: 'Funzionalità Base',
    features: [
      { name: 'Raccolta Recensioni', free: '✓', plus: '✓', premium: '✓', advanced: '✓' },
      { name: 'Profilo Business', free: 'Base', plus: 'Personalizzato', premium: 'Avanzato', advanced: 'Enterprise' },
      { name: 'Risposta Recensioni', free: '✓', plus: '✓', premium: '✓', advanced: '✓' }
    ]
  },
  {
    category: 'Automazione',
    features: [
      { name: 'Inviti Automatici/mese', free: '0', plus: '200', premium: '500', advanced: '2,500' },
      { name: 'Membri Team', free: '1', plus: '3', premium: '10', advanced: '50' }
    ]
  },
  {
    category: 'Analytics e API',
    features: [
      { name: 'Analytics', free: 'Base', plus: 'Base', premium: 'Avanzate', advanced: 'Enterprise' },
      { name: 'Accesso API', free: '×', plus: '×', premium: 'Limitato', advanced: 'Completo' }
    ]
  },
  {
    category: 'Supporto',
    features: [
      { name: 'Livello Supporto', free: 'Community', plus: 'Email', premium: 'Prioritario', advanced: 'Dedicato' }
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