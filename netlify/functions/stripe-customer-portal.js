// Netlify Function: Stripe Customer Portal
// Allows customers to manage their subscriptions, billing, and invoices

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { customerId } = JSON.parse(event.body);

    if (!customerId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Customer ID is required' })
      };
    }

    console.log('🏢 Creating customer portal session for:', customerId);

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.URL || 'https://frabjous-peony-c1cb3a.netlify.app'}/dashboard`,
    });

    console.log('✅ Customer portal session created');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        portalUrl: portalSession.url
      })
    };

  } catch (error) {
    console.error('❌ Customer portal error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to create customer portal session',
        message: error.message
      })
    };
  }
};