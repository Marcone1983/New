// Netlify Function: Stripe Webhook Handler
// Handles all Stripe events for subscription management

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const payload = event.body;
  const sig = event.headers['stripe-signature'];

  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(payload, sig, endpointSecret);
    console.log('✅ Webhook signature verified:', stripeEvent.type);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  try {
    // Handle the event
    switch (stripeEvent.type) {
      
      case 'customer.subscription.created':
        await handleSubscriptionCreated(stripeEvent.data.object);
        break;
        
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(stripeEvent.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(stripeEvent.data.object);
        break;
        
      default:
        console.log(`🔔 Unhandled event type: ${stripeEvent.type}`);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ received: true })
    };

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Webhook processing failed' })
    };
  }
};

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  console.log('🎉 New subscription created:', subscription.id);
  
  const customer = await stripe.customers.retrieve(subscription.customer);
  const planId = subscription.metadata?.planId || 'plus';
  
  try {
    // Create or update organization
    const { data, error } = await supabase
      .from('organizations')
      .upsert({
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        billing_email: customer.email,
        current_plan_id: planId,
        subscription_status: subscription.status,
        subscription_start_date: new Date(subscription.created * 1000).toISOString(),
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        billing_interval: subscription.items.data[0]?.price.recurring?.interval === 'year' ? 'yearly' : 'monthly'
      }, {
        onConflict: 'stripe_customer_id'
      });

    if (error) throw error;
    
    console.log('✅ Organization updated for subscription:', subscription.id);
    
    // Reset usage tracking for new billing period
    await resetUsageTracking(subscription.customer, planId);
    
  } catch (error) {
    console.error('❌ Error handling subscription created:', error);
  }
}

// Handle subscription updated (plan changes, renewals)
async function handleSubscriptionUpdated(subscription) {
  console.log('📝 Subscription updated:', subscription.id);
  
  const planId = subscription.metadata?.planId || getPlanFromPriceId(subscription.items.data[0]?.price.id);
  
  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        current_plan_id: planId,
        subscription_status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) throw error;
    
    console.log('✅ Subscription updated successfully');
    
  } catch (error) {
    console.error('❌ Error handling subscription updated:', error);
  }
}

// Handle subscription deleted/cancelled
async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Subscription cancelled:', subscription.id);
  
  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        current_plan_id: 'free',
        subscription_status: 'canceled',
        subscription_end_date: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    if (error) throw error;
    
    console.log('✅ Organization downgraded to free plan');
    
  } catch (error) {
    console.error('❌ Error handling subscription deleted:', error);
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  console.log('💰 Payment succeeded:', invoice.id);
  
  try {
    // Log billing history
    const { error } = await supabase
      .from('billing_history')
      .insert({
        organization_id: await getOrganizationIdByCustomer(invoice.customer),
        invoice_number: invoice.number,
        amount: invoice.amount_paid / 100, // Convert cents to euros
        currency: invoice.currency.toUpperCase(),
        status: 'paid',
        period_start: new Date(invoice.period_start * 1000).toISOString(),
        period_end: new Date(invoice.period_end * 1000).toISOString(),
        paid_at: new Date(invoice.created * 1000).toISOString(),
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: invoice.payment_intent
      });

    if (error) throw error;
    
    console.log('✅ Payment logged to billing history');
    
  } catch (error) {
    console.error('❌ Error logging payment:', error);
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  console.log('⚠️ Payment failed:', invoice.id);
  
  try {
    // Update subscription status
    const { error } = await supabase
      .from('organizations')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_customer_id', invoice.customer);

    if (error) throw error;
    
    console.log('⚠️ Organization marked as past_due');
    
  } catch (error) {
    console.error('❌ Error handling payment failed:', error);
  }
}

// Helper functions
async function getOrganizationIdByCustomer(customerId) {
  const { data } = await supabase
    .from('organizations')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single();
    
  return data?.id;
}

function getPlanFromPriceId(priceId) {
  // Map price IDs to plan IDs
  const priceToplan = {
    [process.env.STRIPE_PLUS_MONTHLY_PRICE_ID]: 'plus',
    [process.env.STRIPE_PLUS_YEARLY_PRICE_ID]: 'plus',
    [process.env.STRIPE_PREMIUM_MONTHLY_PRICE_ID]: 'premium',
    [process.env.STRIPE_PREMIUM_YEARLY_PRICE_ID]: 'premium',
    [process.env.STRIPE_ADVANCED_MONTHLY_PRICE_ID]: 'advanced',
    [process.env.STRIPE_ADVANCED_YEARLY_PRICE_ID]: 'advanced'
  };
  
  return priceToplan[priceId] || 'plus';
}

async function resetUsageTracking(customerId, planId) {
  // Get organization ID
  const orgId = await getOrganizationIdByCustomer(customerId);
  if (!orgId) return;
  
  // Reset usage for new billing period
  const metrics = ['reviewInvitesPerMonth', 'apiRequestsPerMonth', 'teamMembers'];
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  
  for (const metric of metrics) {
    await supabase
      .from('usage_tracking')
      .upsert({
        organization_id: orgId,
        metric_name: metric,
        current_usage: 0,
        period_start: now.toISOString(),
        period_end: nextMonth.toISOString()
      }, {
        onConflict: 'organization_id,metric_name,period_start'
      });
  }
}