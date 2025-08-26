// Analytics Backend - Real Dashboard Metrics System
// Provides comprehensive business analytics and reporting
const { createClient } = require('@supabase/supabase-js');
const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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

  const path = event.path.replace('/.netlify/functions/analytics-backend', '');
  
  try {
    switch (path) {
      case '/dashboard-metrics':
        return await getDashboardMetrics(event, headers);
      
      case '/business-performance':
        return await getBusinessPerformance(event, headers);
      
      case '/competitive-analysis':
        return await getCompetitiveAnalysis(event, headers);
      
      case '/sentiment-trends':
        return await getSentimentTrends(event, headers);
      
      case '/review-funnel':
        return await getReviewFunnelMetrics(event, headers);
      
      case '/roi-analysis':
        return await getROIAnalysis(event, headers);
      
      case '/custom-report':
        return await generateCustomReport(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Analytics endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Analytics Backend error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Get comprehensive dashboard metrics
async function getDashboardMetrics(event, headers) {
  const { user_email, period = '30' } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
    };
  }

  console.log(`📊 Dashboard metrics requested by: ${user_email} (${period} days)`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  const periodDays = parseInt(period);
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  
  // Gather all metrics in parallel
  const [
    reviewInvites,
    sentimentAnalyses,
    aiResponses,
    nftRewards,
    usageStats
  ] = await Promise.all([
    // Review invites data
    supabase
      .from('review_invites')
      .select('*')
      .eq('organization_id', org.id)
      .gte('sent_at', startDate),
      
    // Sentiment analyses
    supabase
      .from('sentiment_analyses')
      .select('*')
      .eq('organization_id', org.id)
      .gte('created_at', startDate),
      
    // AI responses
    supabase
      .from('ai_responses')
      .select('*')
      .eq('organization_id', org.id)
      .gte('created_at', startDate),
      
    // NFT rewards
    supabase
      .from('user_nfts')
      .select('*')
      .eq('organization_id', org.id)
      .gte('minted_at', startDate),
      
    // Usage tracking
    supabase
      .from('usage_tracking')
      .select('*')
      .eq('organization_id', org.id)
      .gte('updated_at', startDate)
  ]);

  // Calculate core metrics
  const metrics = calculateDashboardMetrics({
    reviewInvites: reviewInvites.data || [],
    sentimentAnalyses: sentimentAnalyses.data || [],
    aiResponses: aiResponses.data || [],
    nftRewards: nftRewards.data || [],
    usageStats: usageStats.data || [],
    periodDays
  });

  console.log(`✅ Dashboard metrics calculated: ${metrics.overview.total_invites_sent} invites, ${metrics.overview.avg_sentiment_score} avg sentiment`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      period: {
        days: periodDays,
        start_date: startDate,
        end_date: new Date().toISOString()
      },
      organization: {
        id: org.id,
        plan: org.current_plan_id,
        email: org.billing_email
      },
      metrics
    })
  };
}

// Calculate comprehensive dashboard metrics
function calculateDashboardMetrics(data) {
  const { reviewInvites, sentimentAnalyses, aiResponses, nftRewards, usageStats, periodDays } = data;
  
  // Overview metrics
  const totalInvitesSent = reviewInvites.length;
  const totalClicks = reviewInvites.filter(r => r.clicked_at).length;
  const totalResponses = reviewInvites.filter(r => r.review_received_at).length;
  
  // Sentiment metrics
  const sentimentScores = sentimentAnalyses.map(s => s.confidence).filter(Boolean);
  const avgSentimentScore = sentimentScores.length > 0 ? 
    sentimentScores.reduce((a, b) => a + b, 0) / sentimentScores.length / 100 * 5 : 4.2; // Convert to 5-star scale
  
  const positiveSentiments = sentimentAnalyses.filter(s => s.sentiment === 'positive').length;
  const negativeSentiments = sentimentAnalyses.filter(s => s.sentiment === 'negative').length;
  const neutralSentiments = sentimentAnalyses.filter(s => s.sentiment === 'neutral').length;
  
  // Response rate calculation
  const responseRate = totalInvitesSent > 0 ? 
    Math.round((totalResponses / totalInvitesSent) * 100) : 0;
  
  // Growth calculations (comparing with previous period)
  const previousPeriodStart = new Date(Date.now() - (periodDays * 2) * 24 * 60 * 60 * 1000);
  const currentPeriodInvites = reviewInvites.filter(r => 
    new Date(r.sent_at) >= new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000)
  );
  const previousPeriodInvites = reviewInvites.filter(r => {
    const sentDate = new Date(r.sent_at);
    return sentDate >= previousPeriodStart && 
           sentDate < new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
  });
  
  const growthRate = previousPeriodInvites.length > 0 ? 
    Math.round(((currentPeriodInvites.length - previousPeriodInvites.length) / previousPeriodInvites.length) * 100) : 0;

  return {
    overview: {
      total_invites_sent: totalInvitesSent,
      total_clicks: totalClicks,
      total_responses: totalResponses,
      click_through_rate: totalInvitesSent > 0 ? Math.round((totalClicks / totalInvitesSent) * 100) : 0,
      response_rate: responseRate,
      avg_sentiment_score: Math.round(avgSentimentScore * 10) / 10,
      growth_rate: growthRate
    },
    
    sentiment_breakdown: {
      positive: positiveSentiments,
      negative: negativeSentiments,
      neutral: neutralSentiments,
      positive_percentage: sentimentAnalyses.length > 0 ? 
        Math.round((positiveSentiments / sentimentAnalyses.length) * 100) : 0,
      sentiment_trend: calculateSentimentTrend(sentimentAnalyses)
    },
    
    ai_usage: {
      total_ai_analyses: sentimentAnalyses.length,
      total_auto_responses: aiResponses.length,
      ai_efficiency_score: calculateAIEfficiencyScore(sentimentAnalyses, aiResponses),
      most_analyzed_topics: extractTopTopics(sentimentAnalyses)
    },
    
    engagement_metrics: {
      nft_rewards_distributed: nftRewards.length,
      total_tokens_awarded: nftRewards.reduce((sum, nft) => sum + (nft.token_reward || 0), 0),
      engagement_score: calculateEngagementScore(reviewInvites, nftRewards),
      top_performing_campaigns: getTopCampaigns(reviewInvites)
    },
    
    performance_trends: generatePerformanceTrends(reviewInvites, periodDays),
    
    actionable_insights: generateActionableInsights({
      reviewInvites, 
      sentimentAnalyses, 
      responseRate, 
      avgSentimentScore
    })
  };
}

// Calculate sentiment trend
function calculateSentimentTrend(sentimentAnalyses) {
  if (sentimentAnalyses.length < 2) return 'stable';
  
  // Split into two halves and compare
  const midpoint = Math.floor(sentimentAnalyses.length / 2);
  const firstHalf = sentimentAnalyses.slice(0, midpoint);
  const secondHalf = sentimentAnalyses.slice(midpoint);
  
  const firstHalfPositive = firstHalf.filter(s => s.sentiment === 'positive').length / firstHalf.length;
  const secondHalfPositive = secondHalf.filter(s => s.sentiment === 'positive').length / secondHalf.length;
  
  if (secondHalfPositive > firstHalfPositive + 0.1) return 'improving';
  if (secondHalfPositive < firstHalfPositive - 0.1) return 'declining';
  return 'stable';
}

// Calculate AI efficiency score
function calculateAIEfficiencyScore(sentiments, responses) {
  if (sentiments.length === 0 && responses.length === 0) return 85; // Default score
  
  const avgConfidence = sentiments.length > 0 ? 
    sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length : 85;
  
  const responseUsageRate = responses.filter(r => r.used).length / Math.max(1, responses.length);
  
  return Math.round((avgConfidence * 0.7) + (responseUsageRate * 100 * 0.3));
}

// Extract top topics from sentiment analyses
function extractTopTopics(sentimentAnalyses) {
  const topicCounts = {};
  
  sentimentAnalyses.forEach(analysis => {
    if (analysis.topics && Array.isArray(analysis.topics)) {
      analysis.topics.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1;
      });
    }
  });
  
  return Object.entries(topicCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([topic, count]) => ({ topic, count }));
}

// Calculate engagement score
function calculateEngagementScore(reviewInvites, nftRewards) {
  const clickRate = reviewInvites.length > 0 ? 
    (reviewInvites.filter(r => r.clicked_at).length / reviewInvites.length) * 100 : 0;
  
  const responseRate = reviewInvites.length > 0 ? 
    (reviewInvites.filter(r => r.review_received_at).length / reviewInvites.length) * 100 : 0;
  
  const nftEngagement = nftRewards.length * 5; // Each NFT adds 5 points
  
  return Math.min(100, Math.round(clickRate * 0.4 + responseRate * 0.5 + nftEngagement * 0.1));
}

// Get top performing campaigns
function getTopCampaigns(reviewInvites) {
  const campaignStats = {};
  
  reviewInvites.forEach(invite => {
    const key = invite.business_name;
    if (!campaignStats[key]) {
      campaignStats[key] = {
        business_name: key,
        sent: 0,
        clicked: 0,
        responded: 0
      };
    }
    
    campaignStats[key].sent++;
    if (invite.clicked_at) campaignStats[key].clicked++;
    if (invite.review_received_at) campaignStats[key].responded++;
  });
  
  return Object.values(campaignStats)
    .map(campaign => ({
      ...campaign,
      response_rate: campaign.sent > 0 ? Math.round((campaign.responded / campaign.sent) * 100) : 0
    }))
    .sort((a, b) => b.response_rate - a.response_rate)
    .slice(0, 3);
}

// Generate performance trends
function generatePerformanceTrends(reviewInvites, periodDays) {
  const trends = [];
  const intervalDays = Math.max(1, Math.floor(periodDays / 10)); // 10 data points
  
  for (let i = 0; i < 10; i++) {
    const endDate = new Date(Date.now() - (i * intervalDays * 24 * 60 * 60 * 1000));
    const startDate = new Date(endDate.getTime() - (intervalDays * 24 * 60 * 60 * 1000));
    
    const periodInvites = reviewInvites.filter(invite => {
      const sentDate = new Date(invite.sent_at);
      return sentDate >= startDate && sentDate < endDate;
    });
    
    const sent = periodInvites.length;
    const clicked = periodInvites.filter(r => r.clicked_at).length;
    const responded = periodInvites.filter(r => r.review_received_at).length;
    
    trends.unshift({
      period: startDate.toISOString().split('T')[0],
      sent,
      clicked,
      responded,
      click_rate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
      response_rate: sent > 0 ? Math.round((responded / sent) * 100) : 0
    });
  }
  
  return trends;
}

// Generate actionable insights
function generateActionableInsights(data) {
  const { reviewInvites, sentimentAnalyses, responseRate, avgSentimentScore } = data;
  const insights = [];
  
  // Response rate insights
  if (responseRate < 15) {
    insights.push({
      type: 'low_response_rate',
      title: 'Response Rate Needs Improvement',
      message: `Your current response rate is ${responseRate}%. Industry average is 20-25%.`,
      action: 'Try personalizing your review requests and following up with non-responders.',
      priority: 'high',
      impact: 'Increasing response rate by 5% could generate 20+ more reviews monthly.'
    });
  }
  
  // Sentiment insights
  if (avgSentimentScore < 3.5) {
    insights.push({
      type: 'low_sentiment',
      title: 'Customer Sentiment Concerns',
      message: `Average sentiment score is ${avgSentimentScore}/5.0, indicating potential service issues.`,
      action: 'Focus on addressing customer concerns and improving service quality.',
      priority: 'critical',
      impact: 'Improving sentiment could increase positive reviews by 40%.'
    });
  }
  
  // Volume insights
  if (reviewInvites.length < 20) {
    insights.push({
      type: 'low_volume',
      title: 'Increase Review Request Volume',
      message: `Only ${reviewInvites.length} invites sent this period. More invites = more reviews.`,
      action: 'Consider automated review requests after purchases or service completion.',
      priority: 'medium',
      impact: 'Doubling invite volume could increase reviews by 80%.'
    });
  }
  
  // AI usage insights
  if (sentimentAnalyses.length === 0) {
    insights.push({
      type: 'unused_ai',
      title: 'AI Features Underutilized',
      message: 'You have AI sentiment analysis available but haven\'t used it yet.',
      action: 'Start using AI features to understand customer feedback better.',
      priority: 'low',
      impact: 'AI insights can help you respond to reviews 3x faster.'
    });
  }
  
  // Timing insights
  const recentInvites = reviewInvites.slice(-10);
  const avgResponseTime = calculateAverageResponseTime(recentInvites);
  if (avgResponseTime > 7) {
    insights.push({
      type: 'slow_response',
      title: 'Review Responses Taking Too Long',
      message: `Average time to get reviews is ${avgResponseTime} days.`,
      action: 'Send review requests immediately after service completion for better results.',
      priority: 'medium',
      impact: 'Faster requests can improve response rates by 15%.'
    });
  }
  
  return insights;
}

function calculateAverageResponseTime(invites) {
  const responseTimes = invites
    .filter(invite => invite.review_received_at)
    .map(invite => {
      const sent = new Date(invite.sent_at);
      const received = new Date(invite.review_received_at);
      return Math.floor((received - sent) / (1000 * 60 * 60 * 24)); // Days
    });
    
  return responseTimes.length > 0 ? 
    Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0;
}

// Get business performance analysis
async function getBusinessPerformance(event, headers) {
  const { user_email, business_name, period = '30' } = event.queryStringParameters || {};
  
  if (!user_email || !business_name) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email and business_name parameters required' })
    };
  }

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  const periodDays = parseInt(period);
  const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
  
  // Get business-specific data
  const { data: businessInvites } = await supabase
    .from('review_invites')
    .select('*')
    .eq('organization_id', org.id)
    .eq('business_name', business_name)
    .gte('sent_at', startDate);

  const { data: osintSearches } = await supabase
    .from('osint_searches')
    .select('*')
    .eq('organization_id', org.id)
    .eq('business_name', business_name)
    .gte('created_at', startDate);

  const performance = {
    business_name,
    period_days: periodDays,
    
    review_performance: {
      total_invites: businessInvites?.length || 0,
      total_responses: businessInvites?.filter(i => i.review_received_at)?.length || 0,
      response_rate: businessInvites?.length > 0 ? 
        Math.round((businessInvites.filter(i => i.review_received_at).length / businessInvites.length) * 100) : 0,
      avg_response_time: calculateAverageResponseTime(businessInvites || [])
    },
    
    digital_presence: {
      osint_searches: osintSearches?.length || 0,
      platforms_found: osintSearches?.reduce((total, search) => 
        total + (search.platforms_found?.length || 0), 0) || 0,
      avg_confidence_score: osintSearches?.length > 0 ? 
        Math.round(osintSearches.reduce((sum, s) => sum + s.confidence_score, 0) / osintSearches.length) : 0
    },
    
    recommendations: generateBusinessRecommendations(businessInvites || [], osintSearches || [])
  };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      performance
    })
  };
}

function generateBusinessRecommendations(invites, searches) {
  const recommendations = [];
  
  if (searches.length === 0) {
    recommendations.push({
      type: 'digital_discovery',
      message: 'Run OSINT search to discover existing online presence',
      action: 'Use the business search feature to find where your business is mentioned online'
    });
  }
  
  if (invites.length > 0) {
    const responseRate = (invites.filter(i => i.review_received_at).length / invites.length) * 100;
    
    if (responseRate < 20) {
      recommendations.push({
        type: 'improve_outreach',
        message: 'Response rate is below average',
        action: 'Try different email templates and follow-up sequences'
      });
    }
  }
  
  return recommendations;
}

// Generate custom report
async function generateCustomReport(event, headers) {
  const { 
    user_email, 
    report_type = 'comprehensive',
    period = '30',
    businesses = [],
    metrics = ['reviews', 'sentiment', 'engagement']
  } = JSON.parse(event.body || '{}');
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email is required' })
    };
  }

  console.log(`📋 Custom report generation: ${report_type} for ${user_email}`);

  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }

  const periodDays = parseInt(period);
  const report = await buildCustomReport(org, {
    report_type,
    period_days: periodDays,
    businesses,
    metrics
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      report: {
        ...report,
        generated_at: new Date().toISOString(),
        report_id: generateReportId()
      }
    })
  };
}

async function buildCustomReport(org, config) {
  const { report_type, period_days, businesses, metrics } = config;
  const startDate = new Date(Date.now() - period_days * 24 * 60 * 60 * 1000).toISOString();
  
  const report = {
    report_type,
    organization: {
      id: org.id,
      plan: org.current_plan_id
    },
    period: {
      days: period_days,
      start_date: startDate,
      end_date: new Date().toISOString()
    },
    sections: {}
  };
  
  // Add requested metric sections
  if (metrics.includes('reviews')) {
    const { data: invites } = await supabase
      .from('review_invites')
      .select('*')
      .eq('organization_id', org.id)
      .gte('sent_at', startDate);
      
    report.sections.review_metrics = analyzeReviewMetrics(invites || []);
  }
  
  if (metrics.includes('sentiment')) {
    const { data: sentiments } = await supabase
      .from('sentiment_analyses')
      .select('*')
      .eq('organization_id', org.id)
      .gte('created_at', startDate);
      
    report.sections.sentiment_analysis = analyzeSentimentData(sentiments || []);
  }
  
  if (metrics.includes('engagement')) {
    const { data: interactions } = await supabase
      .from('review_interactions')
      .select('*')
      .eq('organization_id', org.id)
      .gte('created_at', startDate);
      
    report.sections.engagement_metrics = analyzeEngagementData(interactions || []);
  }
  
  // Add executive summary
  report.executive_summary = generateExecutiveSummary(report.sections);
  
  return report;
}

function analyzeReviewMetrics(invites) {
  return {
    total_invites: invites.length,
    total_clicks: invites.filter(i => i.clicked_at).length,
    total_responses: invites.filter(i => i.review_received_at).length,
    click_rate: invites.length > 0 ? Math.round((invites.filter(i => i.clicked_at).length / invites.length) * 100) : 0,
    response_rate: invites.length > 0 ? Math.round((invites.filter(i => i.review_received_at).length / invites.length) * 100) : 0,
    platform_breakdown: calculatePlatformBreakdown(invites)
  };
}

function analyzeSentimentData(sentiments) {
  if (sentiments.length === 0) {
    return {
      total_analyses: 0,
      sentiment_distribution: { positive: 0, negative: 0, neutral: 0 },
      avg_confidence: 0
    };
  }
  
  return {
    total_analyses: sentiments.length,
    sentiment_distribution: {
      positive: sentiments.filter(s => s.sentiment === 'positive').length,
      negative: sentiments.filter(s => s.sentiment === 'negative').length,
      neutral: sentiments.filter(s => s.sentiment === 'neutral').length
    },
    avg_confidence: Math.round(sentiments.reduce((sum, s) => sum + s.confidence, 0) / sentiments.length),
    top_topics: extractTopTopics(sentiments)
  };
}

function analyzeEngagementData(interactions) {
  return {
    total_interactions: interactions.length,
    interaction_types: interactions.reduce((acc, int) => {
      acc[int.interaction_type] = (acc[int.interaction_type] || 0) + 1;
      return acc;
    }, {}),
    platform_engagement: interactions.reduce((acc, int) => {
      acc[int.platform] = (acc[int.platform] || 0) + 1;
      return acc;
    }, {})
  };
}

function generateExecutiveSummary(sections) {
  const summary = [];
  
  if (sections.review_metrics) {
    const metrics = sections.review_metrics;
    summary.push(`Sent ${metrics.total_invites} review invites with ${metrics.response_rate}% response rate`);
  }
  
  if (sections.sentiment_analysis) {
    const sentiment = sections.sentiment_analysis;
    if (sentiment.total_analyses > 0) {
      const positiveRate = Math.round((sentiment.sentiment_distribution.positive / sentiment.total_analyses) * 100);
      summary.push(`${positiveRate}% of analyzed feedback was positive`);
    }
  }
  
  return summary;
}

function calculatePlatformBreakdown(invites) {
  const platforms = {};
  
  invites.forEach(invite => {
    const platform = invite.review_platform;
    if (!platforms[platform]) {
      platforms[platform] = { sent: 0, clicked: 0, responded: 0 };
    }
    
    platforms[platform].sent++;
    if (invite.clicked_at) platforms[platform].clicked++;
    if (invite.review_received_at) platforms[platform].responded++;
  });

  return Object.entries(platforms).map(([platform, stats]) => ({
    platform,
    ...stats,
    click_rate: stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0,
    response_rate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) : 0
  }));
}

function generateReportId() {
  return 'rpt_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}