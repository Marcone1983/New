// Review Management System - Core Business Logic
// Handles review invites, responses, tracking, and analytics
const { createClient } = require('@supabase/supabase-js');
const { checkAndTrackUsage, getOrganizationByEmail, USAGE_METRICS } = require('./usage-tracker');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Email templates for review requests
const EMAIL_TEMPLATES = {
  initial_request: {
    subject: "💫 Share Your Experience with {business_name}",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4f46e5;">Hi {customer_name}! 👋</h2>
        <p>We hope you had a great experience with <strong>{business_name}</strong>!</p>
        <p>Would you mind taking 2 minutes to share your feedback? Your review helps us improve and helps other customers make informed decisions.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{review_link}" style="background: #4f46e5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold;">
            ⭐ Leave a Review
          </a>
        </div>
        <p style="font-size: 14px; color: #666;">
          This should only take a moment, and we truly appreciate your time!<br>
          Best regards,<br>
          The {business_name} Team
        </p>
      </div>
    `
  },
  
  reminder: {
    subject: "🙏 Quick reminder: Your review would mean a lot",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h3 style="color: #4f46e5;">Hi {customer_name},</h3>
        <p>Just a gentle reminder about sharing your experience with <strong>{business_name}</strong>.</p>
        <p>We know you're busy, but your feedback would really help us serve you and other customers better.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="{review_link}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px;">
            📝 Quick Review (2 minutes)
          </a>
        </div>
        <p style="font-size: 12px; color: #888;">
          If you'd prefer not to receive these reminders, <a href="{unsubscribe_link}">click here</a>.
        </p>
      </div>
    `
  },
  
  thank_you: {
    subject: "🎉 Thank you for your amazing review!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">Thank you, {customer_name}! 🌟</h2>
        <p>We just saw your review and we're thrilled that you had such a positive experience with <strong>{business_name}</strong>!</p>
        <p>Reviews like yours help us continue to provide excellent service and help other customers discover what we do.</p>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; font-style: italic; color: #166534;">"{review_excerpt}"</p>
        </div>
        <p>We can't wait to serve you again soon!</p>
        <p>With gratitude,<br>The {business_name} Team</p>
      </div>
    `
  }
};

// SMS templates
const SMS_TEMPLATES = {
  initial_request: "Hi {customer_name}! Hope you loved your experience with {business_name}. Mind leaving a quick review? {review_link} Thanks! 😊",
  reminder: "Quick reminder from {business_name} - your review would mean a lot! {review_link} (2 min) 🙏"
};

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const path = event.path.replace('/.netlify/functions/review-management', '');
  
  try {
    switch (path) {
      case '/send-invite':
        return await sendReviewInvite(event, headers);
      
      case '/send-bulk-invites':
        return await sendBulkReviewInvites(event, headers);
      
      case '/track-response':
        return await trackReviewResponse(event, headers);
      
      case '/get-campaigns':
        return await getReviewCampaigns(event, headers);
      
      case '/get-analytics':
        return await getReviewAnalytics(event, headers);
      
      case '/manage-campaign':
        return await manageCampaign(event, headers);
      
      case '/auto-follow-up':
        return await autoFollowUp(event, headers);
        
      default:
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ error: 'Review management endpoint not found' })
        };
    }
  } catch (error) {
    console.error('Review Management error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Send individual review invite
async function sendReviewInvite(event, headers) {
  const { 
    customer_email, 
    customer_name, 
    business_name, 
    user_email,
    review_platform = 'google',
    send_method = 'email',
    custom_message = null 
  } = JSON.parse(event.body || '{}');
  
  if (!customer_email || !customer_name || !business_name || !user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ 
        error: 'customer_email, customer_name, business_name, and user_email are required' 
      })
    };
  }
  
  console.log(`📧 Review invite: ${customer_name} (${customer_email}) for ${business_name} by ${user_email}`);
  
  // Get organization and track usage
  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }
  
  // Check and track review invites usage
  const usageResult = await checkAndTrackUsage(
    org.id, 
    USAGE_METRICS.REVIEW_INVITES, 
    1, 
    'review_invite_sent'
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
        upgrade_message: `Upgrade to higher plan to send more review invites per month`
      })
    };
  }

  // Generate review links
  const reviewLinks = generateReviewLinks(business_name, review_platform);
  
  // Create invite record
  const inviteId = generateInviteId();
  const trackingLink = `${process.env.URL}/.netlify/functions/review-management/track-response?invite=${inviteId}`;
  
  // Store invite in database
  const { data: invite, error: insertError } = await supabase
    .from('review_invites')
    .insert({
      id: inviteId,
      organization_id: org.id,
      customer_email,
      customer_name,
      business_name,
      review_platform,
      send_method,
      review_links: reviewLinks,
      tracking_link: trackingLink,
      status: 'sent',
      sent_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    })
    .select()
    .single();
    
  if (insertError) {
    console.error('Error storing invite:', insertError);
    throw insertError;
  }

  // Send the invite
  let deliveryResult;
  if (send_method === 'email') {
    deliveryResult = await sendEmailInvite(invite, custom_message);
  } else if (send_method === 'sms') {
    deliveryResult = await sendSMSInvite(invite, custom_message);
  }
  
  // Update delivery status
  await supabase
    .from('review_invites')
    .update({
      delivery_status: deliveryResult.success ? 'delivered' : 'failed',
      delivery_details: deliveryResult
    })
    .eq('id', inviteId);

  console.log(`✅ Review invite sent successfully to ${customer_name}: ${deliveryResult.success ? 'delivered' : 'failed'}`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      invite_id: inviteId,
      customer: {
        name: customer_name,
        email: customer_email
      },
      delivery: deliveryResult,
      review_links: reviewLinks,
      tracking_link: trackingLink,
      expires_at: invite.expires_at,
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

// Generate review links for different platforms
function generateReviewLinks(businessName, platform) {
  const encodedName = encodeURIComponent(businessName);
  
  const links = {
    google: `https://search.google.com/local/writereview?placeid=${generatePlaceId(businessName)}`,
    yelp: `https://www.yelp.com/writeareview/biz/${businessName.toLowerCase().replace(/\s+/g, '-')}`,
    facebook: `https://www.facebook.com/${businessName.replace(/\s+/g, '')}/reviews`,
    trustpilot: `https://www.trustpilot.com/evaluate/${businessName.toLowerCase().replace(/\s+/g, '-')}`,
    tripadvisor: `https://www.tripadvisor.com/UserReviewEdit-g60763-d${generateTripAdvisorId()}-${encodedName}`
  };
  
  return {
    primary: links[platform] || links.google,
    all_platforms: links
  };
}

// Send email invite
async function sendEmailInvite(invite, customMessage) {
  const template = EMAIL_TEMPLATES.initial_request;
  
  let emailHTML = template.html
    .replace(/{customer_name}/g, invite.customer_name)
    .replace(/{business_name}/g, invite.business_name)
    .replace(/{review_link}/g, invite.tracking_link);
    
  let emailSubject = template.subject
    .replace(/{business_name}/g, invite.business_name);
  
  if (customMessage) {
    emailHTML = emailHTML.replace('<p>We hope you had a great experience', `<p>${customMessage}</p><p>We hope you had a great experience`);
  }
  
  // Simulate email sending (in real implementation, integrate with SendGrid, Mailgun, etc.)
  const emailResult = await simulateEmailSending({
    to: invite.customer_email,
    subject: emailSubject,
    html: emailHTML
  });
  
  return emailResult;
}

// Send SMS invite
async function sendSMSInvite(invite, customMessage) {
  const template = customMessage || SMS_TEMPLATES.initial_request;
  
  const smsText = template
    .replace(/{customer_name}/g, invite.customer_name)
    .replace(/{business_name}/g, invite.business_name)
    .replace(/{review_link}/g, invite.tracking_link);
  
  // Simulate SMS sending (in real implementation, integrate with Twilio, etc.)
  const smsResult = await simulateSMSSending({
    to: invite.customer_email, // In real app, would be phone number
    text: smsText
  });
  
  return smsResult;
}

// Simulate email sending
async function simulateEmailSending(emailData) {
  // Simulate delivery delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
  
  // Simulate 95% success rate
  const success = Math.random() > 0.05;
  
  return {
    success,
    method: 'email',
    message_id: generateMessageId(),
    provider: 'simulated_email_provider',
    delivered_at: success ? new Date().toISOString() : null,
    error: success ? null : 'Simulated delivery failure'
  };
}

// Simulate SMS sending
async function simulateSMSSending(smsData) {
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
  
  const success = Math.random() > 0.10; // 90% success rate
  
  return {
    success,
    method: 'sms',
    message_id: generateMessageId(),
    provider: 'simulated_sms_provider',
    delivered_at: success ? new Date().toISOString() : null,
    error: success ? null : 'Simulated SMS delivery failure'
  };
}

// Send bulk review invites
async function sendBulkReviewInvites(event, headers) {
  const { customers, business_name, user_email, send_method = 'email' } = JSON.parse(event.body || '{}');
  
  if (!customers || !Array.isArray(customers) || customers.length === 0) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'customers array is required' })
    };
  }
  
  console.log(`📬 Bulk review invites: ${customers.length} customers for ${business_name} by ${user_email}`);
  
  const org = await getOrganizationByEmail(user_email);
  if (!org) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Could not get user organization' })
    };
  }
  
  // Check bulk invite limits
  const usageResult = await checkAndTrackUsage(
    org.id, 
    USAGE_METRICS.REVIEW_INVITES, 
    customers.length, 
    'bulk_review_invites'
  );
  
  if (!usageResult.allowed) {
    return {
      statusCode: 429,
      headers,
      body: JSON.stringify({
        error: usageResult.error,
        message: `Cannot send ${customers.length} invites. ${usageResult.message}`,
        usage: {
          current: usageResult.current,
          limit: usageResult.limit,
          requested: customers.length,
          planId: usageResult.planId,
          upgradeRequired: usageResult.upgradeRequired
        }
      })
    };
  }

  const results = [];
  
  // Process each customer
  for (const customer of customers) {
    try {
      const inviteEvent = {
        ...event,
        body: JSON.stringify({
          customer_email: customer.email,
          customer_name: customer.name,
          business_name,
          user_email,
          send_method
        })
      };
      
      // Send individual invite (this will handle its own usage tracking)
      const result = await sendReviewInvite(inviteEvent, headers);
      const resultData = JSON.parse(result.body);
      
      results.push({
        customer: customer.name,
        email: customer.email,
        success: resultData.success,
        invite_id: resultData.invite_id,
        error: resultData.error || null
      });
      
    } catch (error) {
      results.push({
        customer: customer.name,
        email: customer.email,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  console.log(`✅ Bulk invites completed: ${successCount} sent, ${failureCount} failed`);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      bulk_campaign: {
        total_customers: customers.length,
        successfully_sent: successCount,
        failed: failureCount,
        success_rate: Math.round((successCount / customers.length) * 100)
      },
      results,
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

// Track review response
async function trackReviewResponse(event, headers) {
  const { invite } = event.queryStringParameters || {};
  
  if (!invite) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'invite parameter required' })
    };
  }
  
  // Get invite from database
  const { data: inviteRecord, error } = await supabase
    .from('review_invites')
    .select('*')
    .eq('id', invite)
    .single();
    
  if (error || !inviteRecord) {
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: 'Invite not found or expired' })
    };
  }

  // Update click tracking
  await supabase
    .from('review_invites')
    .update({
      clicked_at: new Date().toISOString(),
      status: 'clicked'
    })
    .eq('id', invite);
  
  // Track click event
  await supabase
    .from('review_interactions')
    .insert({
      invite_id: invite,
      organization_id: inviteRecord.organization_id,
      interaction_type: 'click',
      platform: inviteRecord.review_platform,
      created_at: new Date().toISOString()
    });

  // Redirect to actual review platform
  const redirectUrl = inviteRecord.review_links?.primary || 
    `https://www.google.com/search?q=${encodeURIComponent(inviteRecord.business_name)} reviews`;

  return {
    statusCode: 302,
    headers: {
      ...headers,
      Location: redirectUrl
    },
    body: ''
  };
}

// Get review campaigns
async function getReviewCampaigns(event, headers) {
  const { user_email } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
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

  // Get campaigns (review invites grouped by business)
  const { data: invites, error } = await supabase
    .from('review_invites')
    .select('*')
    .eq('organization_id', org.id)
    .order('sent_at', { ascending: false });
    
  if (error) {
    throw error;
  }

  // Group by business and calculate metrics
  const campaignsByBusiness = {};
  
  invites.forEach(invite => {
    if (!campaignsByBusiness[invite.business_name]) {
      campaignsByBusiness[invite.business_name] = {
        business_name: invite.business_name,
        invites: [],
        metrics: {
          total_sent: 0,
          total_clicked: 0,
          total_responded: 0,
          click_rate: 0,
          response_rate: 0
        }
      };
    }
    
    campaignsByBusiness[invite.business_name].invites.push(invite);
    campaignsByBusiness[invite.business_name].metrics.total_sent++;
    
    if (invite.clicked_at) {
      campaignsByBusiness[invite.business_name].metrics.total_clicked++;
    }
    
    if (invite.review_received_at) {
      campaignsByBusiness[invite.business_name].metrics.total_responded++;
    }
  });

  // Calculate rates
  Object.values(campaignsByBusiness).forEach(campaign => {
    const metrics = campaign.metrics;
    metrics.click_rate = metrics.total_sent > 0 ? 
      Math.round((metrics.total_clicked / metrics.total_sent) * 100) : 0;
    metrics.response_rate = metrics.total_sent > 0 ? 
      Math.round((metrics.total_responded / metrics.total_sent) * 100) : 0;
  });

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      campaigns: Object.values(campaignsByBusiness),
      summary: {
        total_campaigns: Object.keys(campaignsByBusiness).length,
        total_invites: invites.length,
        recent_activity: invites.slice(0, 10)
      }
    })
  };
}

// Get review analytics
async function getReviewAnalytics(event, headers) {
  const { user_email, business_name, days = 30 } = event.queryStringParameters || {};
  
  if (!user_email) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'user_email parameter required' })
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

  const daysAgo = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  
  let query = supabase
    .from('review_invites')
    .select('*')
    .eq('organization_id', org.id)
    .gte('sent_at', daysAgo);
    
  if (business_name) {
    query = query.eq('business_name', business_name);
  }

  const { data: invites, error } = await query;
  
  if (error) {
    throw error;
  }

  // Calculate comprehensive analytics
  const analytics = calculateReviewAnalytics(invites, days);

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      success: true,
      period: {
        days: parseInt(days),
        start_date: daysAgo,
        end_date: new Date().toISOString()
      },
      business_name: business_name || 'All Businesses',
      analytics
    })
  };
}

// Calculate review analytics
function calculateReviewAnalytics(invites, days) {
  const total = invites.length;
  const clicked = invites.filter(i => i.clicked_at).length;
  const responded = invites.filter(i => i.review_received_at).length;
  const delivered = invites.filter(i => i.delivery_status === 'delivered').length;
  
  return {
    overview: {
      total_invites_sent: total,
      successfully_delivered: delivered,
      total_clicks: clicked,
      total_reviews_received: responded,
      delivery_rate: total > 0 ? Math.round((delivered / total) * 100) : 0,
      click_through_rate: total > 0 ? Math.round((clicked / total) * 100) : 0,
      conversion_rate: total > 0 ? Math.round((responded / total) * 100) : 0
    },
    
    performance_trends: generatePerformanceTrends(invites, days),
    
    platform_breakdown: calculatePlatformBreakdown(invites),
    
    timing_analysis: calculateTimingAnalysis(invites),
    
    recommendations: generateAnalyticsRecommendations(invites)
  };
}

function generatePerformanceTrends(invites, days) {
  // Group by day
  const dailyStats = {};
  
  invites.forEach(invite => {
    const day = invite.sent_at.split('T')[0];
    if (!dailyStats[day]) {
      dailyStats[day] = { sent: 0, clicked: 0, responded: 0 };
    }
    
    dailyStats[day].sent++;
    if (invite.clicked_at) dailyStats[day].clicked++;
    if (invite.review_received_at) dailyStats[day].responded++;
  });

  return Object.entries(dailyStats).map(([date, stats]) => ({
    date,
    ...stats,
    click_rate: stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0,
    conversion_rate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) : 0
  }));
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
    conversion_rate: stats.sent > 0 ? Math.round((stats.responded / stats.sent) * 100) : 0
  }));
}

function calculateTimingAnalysis(invites) {
  const hourStats = new Array(24).fill(0).map(() => ({ sent: 0, clicked: 0 }));
  const dayStats = new Array(7).fill(0).map(() => ({ sent: 0, clicked: 0 }));
  
  invites.forEach(invite => {
    const sentDate = new Date(invite.sent_at);
    const hour = sentDate.getHours();
    const day = sentDate.getDay();
    
    hourStats[hour].sent++;
    dayStats[day].sent++;
    
    if (invite.clicked_at) {
      hourStats[hour].clicked++;
      dayStats[day].clicked++;
    }
  });

  return {
    best_hours: hourStats.map((stats, hour) => ({
      hour,
      ...stats,
      click_rate: stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0
    })).sort((a, b) => b.click_rate - a.click_rate),
    
    best_days: dayStats.map((stats, day) => ({
      day: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day],
      ...stats,
      click_rate: stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0
    })).sort((a, b) => b.click_rate - a.click_rate)
  };
}

function generateAnalyticsRecommendations(invites) {
  const recommendations = [];
  
  const clickRate = invites.length > 0 ? (invites.filter(i => i.clicked_at).length / invites.length) * 100 : 0;
  const conversionRate = invites.length > 0 ? (invites.filter(i => i.review_received_at).length / invites.length) * 100 : 0;
  
  if (clickRate < 20) {
    recommendations.push({
      type: 'improve_subject_lines',
      message: 'Low click rate detected. Consider A/B testing subject lines and personalization.',
      priority: 'high'
    });
  }
  
  if (conversionRate < 10) {
    recommendations.push({
      type: 'simplify_process',
      message: 'Low conversion rate. Make the review process easier with direct platform links.',
      priority: 'high'
    });
  }
  
  if (invites.length < 50) {
    recommendations.push({
      type: 'increase_volume',
      message: 'Send more invites to get statistically significant results.',
      priority: 'medium'
    });
  }
  
  return recommendations;
}

// Helper functions
function generateInviteId() {
  return 'rv_' + Math.random().toString(36).substr(2, 16);
}

function generatePlaceId(businessName) {
  return 'ChIJ' + Math.random().toString(36).substr(2, 20); // Mock Google Place ID
}

function generateTripAdvisorId() {
  return Math.floor(Math.random() * 10000000) + 1000000;
}

function generateMessageId() {
  return 'msg_' + Math.random().toString(36).substr(2, 12);
}