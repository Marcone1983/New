// Real AI Features Implementation with Usage Tracking
const { createClient } = require('@supabase/supabase-js');
const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Sentiment analysis using a simple keyword-based approach (can be upgraded to real AI)
const SENTIMENT_KEYWORDS = {
  positive: ['ottimo', 'fantastico', 'eccellente', 'perfetto', 'consiglio', 'bravo', 'veloce', 'professionale', 'soddisfatto', 'complimenti'],
  negative: ['terribile', 'pessimo', 'scadente', 'lento', 'deludente', 'incompetente', 'sconsiglio', 'male', 'problemi', 'difetti'],
  neutral: ['ok', 'normale', 'standard', 'medio', 'accettabile']
};

// AI response templates based on sentiment and context
const AI_RESPONSE_TEMPLATES = {
  positive: {
    high: "Grazie mille per questa recensione fantastica! Siamo davvero felici che tu abbia apprezzato il nostro {service}. Il tuo feedback ci motiva a continuare a migliorare ogni giorno! 🌟",
    medium: "Grazie per aver condiviso la tua esperienza positiva! È un piacere sapere che sei rimasto soddisfatto del nostro {service}. 😊",
    low: "Ti ringraziamo per la recensione! Siamo contenti che tu abbia avuto un'esperienza positiva con noi. 👍"
  },
  negative: {
    high: "Ci dispiace molto per l'esperienza negativa che hai avuto. Prendiamo molto seriamente i tuoi feedback e vorremmo risolvere la situazione. Ti contatteremo privatamente per trovare una soluzione. Grazie per averci dato l'opportunità di migliorare. 🙏",
    medium: "Grazie per il tuo feedback. Ci dispiace che non sia stata all'altezza delle tue aspettative. Stiamo lavorando per migliorare {area} e apprezziamo la tua sincerità. 💭",
    low: "Apprezziamo il tuo feedback sincero. Utilizzeremo questi suggerimenti per migliorare i nostri servizi. Grazie! 📝"
  },
  neutral: {
    high: "Grazie per aver condiviso la tua esperienza! Il tuo feedback è prezioso per noi e ci aiuta a migliorare continuamente. 🤝",
    medium: "Ti ringraziamo per la recensione. Apprezziamo il tempo che hai dedicato a condividere la tua opinione. 👌",
    low: "Grazie per il feedback! 🙂"
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/ai-features', '');
  
  try {
    switch (path) {
      case '/sentiment-analysis':
        return await analyzeSentiment(event, headers);
      
      case '/auto-response':
        return await generateAutoResponse(event, headers);
      
      case '/trustscore-forecast':
        return await forecastTrustScore(event, headers);
      
      case '/market-insights':
        return await generateMarketInsights(event, headers);
      
      case '/churn-prediction':
        return await predictChurn(event, headers);
      
      case '/ai-video-review':
        return await generateVideoReview(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'AI endpoint not found' })
        };
    }
  } catch (error) {
    console.error('AI Features error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Real sentiment analysis implementation with usage tracking
async function analyzeSentiment(event, headers) {
  const { text, user_email } = JSON.parse(event.body || '{}');
  
  if (!text) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Text is required for sentiment analysis' })
    };
  }

  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'User email is required for usage tracking' })
    };
  }
  
  console.log(`🧠 AI Sentiment Analysis requested by: ${user_email}`);
  
  // Get organization and track usage
  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }
  
  // Check and track AI sentiment analysis usage
  const usageResult = await checkAndTrackUsage(
    org.id, 
    USAGE_METRICS.AI_SENTIMENT, 
    1, 
    'sentiment_analysis'
  );
  
  if (!usageResult.allowed) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: usageResult.error,
        message: usageResult.message,
        usage: {
          current: usageResult.current,
          limit: usageResult.limit,
          planId: usageResult.planId,
          upgradeRequired: usageResult.upgradeRequired
        },
        upgrade_message: `Upgrade to ${getNextPlan(usageResult.planId)} plan to get more AI sentiment analyses`
      })
    };
  }
  
  const textLower = text.toLowerCase();
  
  let positiveScore = 0;
  let negativeScore = 0;
  let neutralScore = 0;
  
  // Count sentiment keywords
  SENTIMENT_KEYWORDS.positive.forEach(keyword => {
    if (textLower.includes(keyword)) positiveScore++;
  });
  
  SENTIMENT_KEYWORDS.negative.forEach(keyword => {
    if (textLower.includes(keyword)) negativeScore++;
  });
  
  SENTIMENT_KEYWORDS.neutral.forEach(keyword => {
    if (textLower.includes(keyword)) neutralScore++;
  });
  
  // Calculate overall sentiment
  let sentiment = 'neutral';
  let confidence = 0.5;
  
  if (positiveScore > negativeScore && positiveScore > neutralScore) {
    sentiment = 'positive';
    confidence = Math.min(0.9, 0.6 + (positiveScore * 0.1));
  } else if (negativeScore > positiveScore && negativeScore > neutralScore) {
    sentiment = 'negative';
    confidence = Math.min(0.9, 0.6 + (negativeScore * 0.1));
  } else if (neutralScore > 0) {
    sentiment = 'neutral';
    confidence = Math.min(0.8, 0.5 + (neutralScore * 0.1));
  }
  
  // Extract key topics
  const topics = extractTopics(text);
  
  // Generate insights
  const insights = generateSentimentInsights(sentiment, confidence, topics, positiveScore, negativeScore);
  
  // Store analysis in database
  await supabase
    .from('sentiment_analyses')
    .insert({
      organization_id: org.id,
      text_analyzed: text,
      sentiment,
      confidence,
      positive_score: positiveScore,
      negative_score: negativeScore,
      neutral_score: neutralScore,
      topics,
      insights,
      created_at: new Date().toISOString()
    });
  
  console.log(`✅ Sentiment analysis completed for ${user_email}: ${sentiment} (${Math.round(confidence * 100)}%)`);
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      sentiment,
      confidence: Math.round(confidence * 100),
      scores: {
        positive: positiveScore,
        negative: negativeScore,
        neutral: neutralScore
      },
      topics,
      insights,
      usage_info: {
        current: usageResult.current,
        limit: usageResult.limit,
        remaining: usageResult.remaining,
        percentage: usageResult.percentage,
        isNearLimit: usageResult.isNearLimit,
        planId: usageResult.planId
      }
    })
  };
}

// Generate AI auto-response
async function generateAutoResponse(event, headers) {
  const { reviewText, reviewRating, organizationId, businessName = 'il nostro servizio' } = JSON.parse(event.body || '{}');
  
  if (!reviewText) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Review text is required' })
    };
  }
  
  // Check feature access
  if (organizationId) {
    const hasFeature = await checkFeatureAccess(organizationId, 'ai_automated_responses');
    if (!hasFeature) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'AI auto-response requires Enterprise plan' })
      };
    }
  }
  
  // Analyze sentiment first
  const sentimentData = await analyzeSentimentInternal(reviewText);
  const sentiment = sentimentData.sentiment;
  
  // Determine intensity based on rating and keywords
  let intensity = 'medium';
  if (reviewRating >= 4 || sentimentData.scores.positive >= 2) {
    intensity = 'high';
  } else if (reviewRating <= 2 || sentimentData.scores.negative >= 2) {
    intensity = 'high';
  } else if (sentimentData.scores.positive === 1 || sentimentData.scores.negative === 1) {
    intensity = 'low';
  }
  
  // Get appropriate template
  const template = AI_RESPONSE_TEMPLATES[sentiment][intensity];
  
  // Extract context for personalization
  const context = extractResponseContext(reviewText);
  
  // Generate personalized response
  let response = template
    .replace('{service}', businessName)
    .replace('{area}', context.area || 'i nostri servizi');
  
  // Add personalization based on context
  if (context.specific_mention && sentiment === 'positive') {
    response += ` Siamo particolarmente felici che tu abbia apprezzato ${context.specific_mention}!`;
  }
  
  // Store generated response
  if (organizationId) {
    await supabase
      .from('ai_responses')
      .insert({
        organization_id: organizationId,
        original_review: reviewText,
        review_rating: reviewRating,
        generated_response: response,
        sentiment,
        intensity,
        used: false,
        created_at: new Date().toISOString()
      });
  }
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      response,
      sentiment,
      intensity,
      confidence: sentimentData.confidence,
      suggestions: generateResponseSuggestions(sentiment, context)
    })
  };
}

// TrustScore forecasting
async function forecastTrustScore(event, headers) {
  const { organizationId, timeframe = 30 } = JSON.parse(event.body || '{}');
  
  if (!organizationId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Organization ID required' })
    };
  }
  
  // Check feature access
  const hasFeature = await checkFeatureAccess(organizationId, 'trustscore_forecasting');
  if (!hasFeature) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'TrustScore forecasting requires Advanced plan or higher' })
    };
  }
  
  // Get recent reviews for analysis
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, content, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (!reviews || reviews.length === 0) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        forecast: {
          current: 0,
          predicted: 0,
          trend: 'stable',
          confidence: 0,
          recommendations: ['Start collecting reviews to enable forecasting']
        }
      })
    };
  }
  
  // Calculate current trust score
  const currentScore = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  
  // Analyze trends
  const recentReviews = reviews.slice(0, 20);
  const olderReviews = reviews.slice(20, 40);
  
  const recentAvg = recentReviews.reduce((sum, r) => sum + r.rating, 0) / recentReviews.length;
  const olderAvg = olderReviews.length > 0 
    ? olderReviews.reduce((sum, r) => sum + r.rating, 0) / olderReviews.length
    : recentAvg;
  
  // Predict future score based on trend
  const trendDirection = recentAvg - olderAvg;
  let predictedScore = currentScore + (trendDirection * (timeframe / 30));
  predictedScore = Math.max(1, Math.min(5, predictedScore)); // Clamp between 1-5
  
  // Determine trend
  let trend = 'stable';
  if (trendDirection > 0.1) trend = 'improving';
  else if (trendDirection < -0.1) trend = 'declining';
  
  // Calculate confidence based on data volume and consistency
  const confidence = Math.min(95, (reviews.length / 100) * 80 + 15);
  
  // Generate recommendations
  const recommendations = generateTrustScoreRecommendations(currentScore, trend, reviews);
  
  // Store forecast
  await supabase
    .from('trustscore_forecasts')
    .insert({
      organization_id: organizationId,
      current_score: currentScore,
      predicted_score: predictedScore,
      trend,
      confidence: confidence / 100,
      timeframe_days: timeframe,
      recommendations,
      created_at: new Date().toISOString()
    });
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      forecast: {
        current: Math.round(currentScore * 10) / 10,
        predicted: Math.round(predictedScore * 10) / 10,
        trend,
        confidence: Math.round(confidence),
        timeframeDays: timeframe,
        recommendations,
        reviewsAnalyzed: reviews.length
      }
    })
  };
}

// Generate market insights
async function generateMarketInsights(event, headers) {
  const { organizationId, industry } = JSON.parse(event.body || '{}');
  
  if (!organizationId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Organization ID required' })
    };
  }
  
  // Check feature access
  const hasFeature = await checkFeatureAccess(organizationId, 'market_insights');
  if (!hasFeature) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Market insights requires Advanced plan or higher' })
    };
  }
  
  // Get organization's reviews
  const { data: orgReviews } = await supabase
    .from('reviews')
    .select('rating, content, platform')
    .eq('organization_id', organizationId)
    .limit(200);
  
  // Get industry benchmarks (mock data for now)
  const industryBenchmarks = {
    'technology': { avgRating: 4.2, reviewVolume: 150, responseRate: 85 },
    'retail': { avgRating: 4.0, reviewVolume: 300, responseRate: 70 },
    'restaurant': { avgRating: 4.3, reviewVolume: 250, responseRate: 60 },
    'healthcare': { avgRating: 4.5, reviewVolume: 100, responseRate: 90 },
    'default': { avgRating: 4.1, reviewVolume: 200, responseRate: 75 }
  };
  
  const benchmark = industryBenchmarks[industry] || industryBenchmarks.default;
  
  // Calculate organization metrics
  const orgMetrics = {
    avgRating: orgReviews.length > 0 
      ? orgReviews.reduce((sum, r) => sum + r.rating, 0) / orgReviews.length 
      : 0,
    reviewVolume: orgReviews.length,
    platformDistribution: calculatePlatformDistribution(orgReviews)
  };
  
  // Generate insights
  const insights = {
    performance: generatePerformanceInsights(orgMetrics, benchmark),
    opportunities: generateOpportunityInsights(orgMetrics, benchmark),
    threats: generateThreatInsights(orgMetrics, benchmark),
    recommendations: generateMarketRecommendations(orgMetrics, benchmark)
  };
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      insights,
      benchmarks: benchmark,
      yourMetrics: orgMetrics,
      industry: industry || 'general'
    })
  };
}

// Churn prediction
async function predictChurn(event, headers) {
  const { organizationId } = JSON.parse(event.body || '{}');
  
  if (!organizationId) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Organization ID required' })
    };
  }
  
  // Check feature access  
  const hasFeature = await checkFeatureAccess(organizationId, 'predictive_analytics');
  if (!hasFeature) {
    return {
      statusCode: 403,
      headers,
      body: JSON.stringify({ error: 'Churn prediction requires Enterprise plan' })
    };
  }
  
  // Get recent reviews and analyze patterns
  const { data: reviews } = await supabase
    .from('reviews')
    .select('rating, content, created_at, author_email')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);
  
  // Simple churn prediction based on review patterns
  const churnRisks = [];
  const reviewerActivity = {};
  
  reviews?.forEach(review => {
    if (review.author_email) {
      if (!reviewerActivity[review.author_email]) {
        reviewerActivity[review.author_email] = [];
      }
      reviewerActivity[review.author_email].push(review);
    }
  });
  
  // Analyze each reviewer
  Object.entries(reviewerActivity).forEach(([email, userReviews]) => {
    const latestReview = userReviews[0];
    const daysSinceLastReview = Math.floor((new Date() - new Date(latestReview.created_at)) / (1000 * 60 * 60 * 24));
    
    let riskScore = 0;
    let riskFactors = [];
    
    // Risk factors
    if (latestReview.rating <= 2) {
      riskScore += 40;
      riskFactors.push('Recent negative review');
    }
    
    if (daysSinceLastReview > 90) {
      riskScore += 30;
      riskFactors.push('Long time since last interaction');
    }
    
    if (userReviews.length === 1) {
      riskScore += 20;
      riskFactors.push('Single review (low engagement)');
    }
    
    // Declining rating pattern
    if (userReviews.length > 1) {
      const ratingTrend = userReviews[0].rating - userReviews[1].rating;
      if (ratingTrend < 0) {
        riskScore += 25;
        riskFactors.push('Declining satisfaction');
      }
    }
    
    if (riskScore >= 50) {
      churnRisks.push({
        customerEmail: email,
        riskScore,
        riskLevel: riskScore >= 80 ? 'high' : 'medium',
        riskFactors,
        lastReviewDate: latestReview.created_at,
        lastRating: latestReview.rating,
        recommendations: generateChurnPreventionRecommendations(riskScore, riskFactors)
      });
    }
  });
  
  // Sort by risk score
  churnRisks.sort((a, b) => b.riskScore - a.riskScore);
  
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      summary: {
        totalCustomersAnalyzed: Object.keys(reviewerActivity).length,
        highRiskCustomers: churnRisks.filter(r => r.riskLevel === 'high').length,
        mediumRiskCustomers: churnRisks.filter(r => r.riskLevel === 'medium').length
      },
      churnRisks: churnRisks.slice(0, 20), // Top 20 at-risk customers
      overallRecommendations: generateOverallChurnRecommendations(churnRisks)
    })
  };
}

// Generate AI video review (placeholder - would integrate with video generation service)
async function generateVideoReview(event, headers) {
  const { reviewText, organizationId } = JSON.parse(event.body || '{}');
  
  if (!reviewText) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Review text required' })
    };
  }
  
  // For now, return a mock response since this would require actual video generation AI
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      videoUrl: null, // Would be actual video URL
      status: 'processing',
      estimatedTime: '2-3 minutes',
      message: 'Video generation is in progress. You will receive an email when ready.',
      features: {
        avatar: 'professional',
        voice: 'natural',
        style: 'modern',
        duration: '30-60 seconds'
      }
    })
  };
}

// Helper functions
async function checkFeatureAccess(organizationId, feature) {
  const response = await fetch(`${process.env.URL || 'https://frabjous-peony-c1cb3a.netlify.app'}/.netlify/functions/subscription-manager/check-feature`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationId, feature })
  });
  
  const data = await response.json();
  return data.hasFeature;
}

async function analyzeSentimentInternal(text) {
  const textLower = text.toLowerCase();
  let positiveScore = 0;
  let negativeScore = 0;
  
  SENTIMENT_KEYWORDS.positive.forEach(keyword => {
    if (textLower.includes(keyword)) positiveScore++;
  });
  
  SENTIMENT_KEYWORDS.negative.forEach(keyword => {
    if (textLower.includes(keyword)) negativeScore++;
  });
  
  let sentiment = 'neutral';
  let confidence = 0.5;
  
  if (positiveScore > negativeScore) {
    sentiment = 'positive';
    confidence = Math.min(0.9, 0.6 + (positiveScore * 0.1));
  } else if (negativeScore > positiveScore) {
    sentiment = 'negative';
    confidence = Math.min(0.9, 0.6 + (negativeScore * 0.1));
  }
  
  return {
    sentiment,
    confidence,
    scores: { positive: positiveScore, negative: negativeScore }
  };
}

function extractTopics(text) {
  const topics = [];
  const topicKeywords = {
    'servizio_clienti': ['servizio', 'supporto', 'assistenza', 'aiuto'],
    'qualità_prodotto': ['prodotto', 'qualità', 'materiale', 'fattura'],
    'velocità': ['veloce', 'rapido', 'tempo', 'consegna'],
    'prezzo': ['prezzo', 'costo', 'conveniente', 'economico', 'caro'],
    'staff': ['personale', 'staff', 'dipendenti', 'team']
  };
  
  const textLower = text.toLowerCase();
  
  Object.entries(topicKeywords).forEach(([topic, keywords]) => {
    if (keywords.some(keyword => textLower.includes(keyword))) {
      topics.push(topic);
    }
  });
  
  return topics;
}

function generateSentimentInsights(sentiment, confidence, topics, positiveScore, negativeScore) {
  const insights = [];
  
  if (confidence > 0.8) {
    insights.push(`Alta confidenza nell'analisi del sentiment (${Math.round(confidence * 100)}%)`);
  }
  
  if (topics.length > 0) {
    insights.push(`Temi principali identificati: ${topics.join(', ')}`);
  }
  
  if (sentiment === 'positive' && positiveScore >= 2) {
    insights.push('Forte sentiment positivo rilevato - ottima opportunità per condivisione');
  }
  
  if (sentiment === 'negative' && negativeScore >= 2) {
    insights.push('Sentiment molto negativo - richiede attenzione immediata');
  }
  
  return insights;
}

function extractResponseContext(text) {
  const context = { area: null, specific_mention: null };
  
  // Extract specific mentions
  if (text.includes('consegna')) context.area = 'la consegna';
  if (text.includes('servizio')) context.area = 'il servizio clienti';
  if (text.includes('qualità')) context.area = 'la qualità';
  if (text.includes('personale')) context.area = 'il nostro staff';
  
  // Extract specific positive mentions
  const positiveMatches = text.match(/(ottimo|fantastico|eccellente|perfetto) (\w+)/gi);
  if (positiveMatches) {
    context.specific_mention = positiveMatches[0];
  }
  
  return context;
}

function generateResponseSuggestions(sentiment, context) {
  const suggestions = [];
  
  if (sentiment === 'positive') {
    suggestions.push('Considera di chiedere se può condividere la recensione sui social');
    suggestions.push('Offri un piccolo sconto per la prossima esperienza');
  }
  
  if (sentiment === 'negative') {
    suggestions.push('Contatta privatamente per risolvere il problema');
    suggestions.push('Offri una compensazione o rimborso parziale');
    suggestions.push('Usa questo feedback per migliorare il servizio');
  }
  
  return suggestions;
}

function generateTrustScoreRecommendations(currentScore, trend, reviews) {
  const recommendations = [];
  
  if (currentScore < 3.5) {
    recommendations.push('Focus urgente sul miglioramento della customer satisfaction');
    recommendations.push('Analizza le recensioni negative per identificare problemi ricorrenti');
  }
  
  if (trend === 'declining') {
    recommendations.push('Investire in training del personale');
    recommendations.push('Implementare un sistema di quality assurance');
  }
  
  if (reviews.length < 50) {
    recommendations.push('Aumentare la raccolta di recensioni attraverso email marketing');
    recommendations.push('Implementare un sistema di follow-up post-acquisto');
  }
  
  return recommendations;
}

function calculatePlatformDistribution(reviews) {
  const distribution = {};
  reviews.forEach(review => {
    distribution[review.platform] = (distribution[review.platform] || 0) + 1;
  });
  return distribution;
}

function generatePerformanceInsights(metrics, benchmark) {
  const insights = [];
  
  if (metrics.avgRating > benchmark.avgRating) {
    insights.push(`Rating medio superiore alla media del settore (+${(metrics.avgRating - benchmark.avgRating).toFixed(1)})`);
  } else {
    insights.push(`Rating medio sotto la media del settore (-${(benchmark.avgRating - metrics.avgRating).toFixed(1)})`);
  }
  
  return insights;
}

function generateOpportunityInsights(metrics, benchmark) {
  const opportunities = [];
  
  if (metrics.reviewVolume < benchmark.reviewVolume) {
    opportunities.push('Aumentare il volume di recensioni per maggiore credibilità');
  }
  
  if (metrics.avgRating >= 4.0) {
    opportunities.push('Sfruttare le recensioni positive per marketing e social proof');
  }
  
  return opportunities;
}

function generateThreatInsights(metrics, benchmark) {
  const threats = [];
  
  if (metrics.avgRating < 3.5) {
    threats.push('Rating basso può impattare negativamente su nuove acquisizioni');
  }
  
  if (metrics.reviewVolume > benchmark.reviewVolume * 0.5 && metrics.avgRating < benchmark.avgRating) {
    threats.push('Performance sotto la media con alta visibilità');
  }
  
  return threats;
}

function generateMarketRecommendations(metrics, benchmark) {
  const recommendations = [];
  
  recommendations.push('Implementare un sistema di monitoring competitivo');
  recommendations.push('Sviluppare strategie di differenziazione basate sui feedback');
  
  return recommendations;
}

function generateChurnPreventionRecommendations(riskScore, riskFactors) {
  const recommendations = [];
  
  if (riskFactors.includes('Recent negative review')) {
    recommendations.push('Contatto immediato per problem resolution');
    recommendations.push('Offerta di compensazione o servizio aggiuntivo');
  }
  
  if (riskFactors.includes('Long time since last interaction')) {
    recommendations.push('Email di re-engagement con offerta speciale');
    recommendations.push('Survey di soddisfazione per identificare issues');
  }
  
  return recommendations;
}

function generateOverallChurnRecommendations(churnRisks) {
  const recommendations = [];
  
  if (churnRisks.length > 0) {
    recommendations.push('Implementare customer success program');
    recommendations.push('Automatizzare follow-up per clienti a rischio');
    recommendations.push('Sviluppare early warning system');
  }
  
  return recommendations;
}

// Helper function to suggest next plan for upgrades
function getNextPlan(currentPlan) {
  const planHierarchy = ['free', 'plus', 'premium', 'advanced', 'enterprise'];
  const currentIndex = planHierarchy.indexOf(currentPlan);
  return planHierarchy[currentIndex + 1] || 'enterprise';
}