// Netlify Function: Create Stripe Checkout Session
// Real payment processing for SocialTrust subscriptions

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
    const { priceId, customerEmail, planId, billingInterval } = JSON.parse(event.body);

    if (!priceId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Price ID is required' })
      };
    }

    console.log('💳 Creating Stripe checkout session:', {
      priceId,
      customerEmail,
      planId,
      billingInterval
    });

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      
      line_items: [{
        price: priceId,
        quantity: 1,
      }],

      // Customer info
      customer_email: customerEmail,
      
      // URLs
      success_url: `${process.env.URL || 'https://frabjous-peony-c1cb3a.netlify.app'}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.URL || 'https://frabjous-peony-c1cb3a.netlify.app'}/pricing`,

      // Metadata for our system
      metadata: {
        planId,
        billingInterval,
        source: 'socialtrust_app'
      },

      // Subscription settings
      subscription_data: {
        metadata: {
          planId,
          billingInterval
        }
      },

      // Customer portal
      allow_promotion_codes: true,
    });

    console.log('✅ Checkout session created:', session.id);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id
      })
    };

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to create checkout session',
        message: error.message
      })
    };
  }
};