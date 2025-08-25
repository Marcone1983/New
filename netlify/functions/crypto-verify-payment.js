// Netlify Function: Verify Crypto Payment
// On-chain payment verification across multiple blockchains

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { paymentId, txHash } = event.httpMethod === 'POST' ? 
      JSON.parse(event.body) : 
      event.queryStringParameters;

    if (!paymentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Payment ID is required' })
      };
    }

    console.log('🔍 Verifying crypto payment:', { paymentId, txHash });

    // Get payment session from database
    const { data: paymentSession, error } = await supabase
      .from('crypto_payment_sessions')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error || !paymentSession) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Payment session not found' })
      };
    }

    // Check if payment is expired
    if (new Date(paymentSession.expires_at) < new Date()) {
      await supabase
        .from('crypto_payment_sessions')
        .update({ status: 'expired' })
        .eq('payment_id', paymentId);
        
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Payment session expired',
          status: 'expired'
        })
      };
    }

    // If transaction hash provided, verify specific transaction
    if (txHash) {
      const verificationResult = await verifyTransaction(paymentSession, txHash);
      
      if (verificationResult.success) {
        // Update payment session as confirmed
        await supabase
          .from('crypto_payment_sessions')
          .update({
            status: 'confirmed',
            tx_hash: txHash,
            confirmed_at: new Date().toISOString(),
            confirmations: verificationResult.confirmations
          })
          .eq('payment_id', paymentId);

        // Create subscription
        await createSubscription(paymentSession, txHash);
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            success: true,
            status: 'confirmed',
            transaction: verificationResult.transaction,
            subscription: {
              planId: paymentSession.plan_id,
              interval: paymentSession.billing_interval,
              activatedAt: new Date().toISOString()
            }
          })
        };
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            success: false,
            error: verificationResult.error,
            status: 'verification_failed'
          })
        };
      }
    }

    // No tx hash provided - check for any payments to our wallet
    const paymentCheck = await checkForPayments(paymentSession);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentSession: {
          id: paymentSession.payment_id,
          status: paymentSession.status,
          expiresAt: paymentSession.expires_at,
          usdAmount: paymentSession.usd_amount,
          cryptoAmount: paymentSession.crypto_amount,
          cryptoSymbol: paymentSession.crypto_symbol,
          receiverWallet: paymentSession.receiver_wallet,
          networkId: paymentSession.network_id,
          timeRemaining: Math.max(0, new Date(paymentSession.expires_at) - new Date())
        },
        paymentFound: paymentCheck.found,
        transactions: paymentCheck.transactions || []
      })
    };

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Payment verification failed',
        message: error.message
      })
    };
  }
};

// Verify specific transaction
async function verifyTransaction(paymentSession, txHash) {
  try {
    const rpcUrl = getRpcUrl(paymentSession.network_id);
    
    // Get transaction details
    const txResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionByHash',
        params: [txHash]
      })
    });
    
    const txData = await txResponse.json();
    const transaction = txData.result;
    
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    // Get transaction receipt for confirmation status
    const receiptResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'eth_getTransactionReceipt',
        params: [txHash]
      })
    });
    
    const receiptData = await receiptResponse.json();
    const receipt = receiptData.result;
    
    if (!receipt || receipt.status !== '0x1') {
      return { success: false, error: 'Transaction failed or not confirmed' };
    }

    // Verify payment details
    const isCorrectReceiver = transaction.to.toLowerCase() === 
      paymentSession.receiver_wallet.toLowerCase();
      
    if (!isCorrectReceiver) {
      return { success: false, error: 'Incorrect receiver address' };
    }

    // For native tokens (ETH, POL, BNB), check value
    const expectedAmount = parseFloat(paymentSession.crypto_amount);
    const receivedAmount = parseFloat(transaction.value) / Math.pow(10, 18);
    
    // Allow 1% tolerance for price fluctuations
    const tolerance = expectedAmount * 0.01;
    const isCorrectAmount = Math.abs(receivedAmount - expectedAmount) <= tolerance;
    
    if (!isCorrectAmount) {
      return { 
        success: false, 
        error: `Incorrect amount. Expected: ${expectedAmount}, Received: ${receivedAmount}`
      };
    }

    // Get current block for confirmations
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    const txBlock = parseInt(receipt.blockNumber, 16);
    const confirmations = currentBlock - txBlock + 1;

    return {
      success: true,
      confirmations,
      transaction: {
        hash: txHash,
        from: transaction.from,
        to: transaction.to,
        value: receivedAmount,
        blockNumber: txBlock,
        confirmations
      }
    };

  } catch (error) {
    console.error('Transaction verification error:', error);
    return { success: false, error: error.message };
  }
}

// Check for payments to our wallet (scanning recent blocks)
async function checkForPayments(paymentSession) {
  try {
    const rpcUrl = getRpcUrl(paymentSession.network_id);
    const receiverWallet = paymentSession.receiver_wallet.toLowerCase();
    const expectedAmount = parseFloat(paymentSession.crypto_amount);
    
    // Get latest block
    const blockResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: []
      })
    });
    
    const blockData = await blockResponse.json();
    const currentBlock = parseInt(blockData.result, 16);
    
    // Scan last 100 blocks for transactions to our wallet
    const transactions = [];
    for (let i = 0; i < 100; i++) {
      const blockNum = currentBlock - i;
      
      const blockDetailResponse = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: blockNum,
          method: 'eth_getBlockByNumber',
          params: [`0x${blockNum.toString(16)}`, true]
        })
      });
      
      const blockDetail = await blockDetailResponse.json();
      const block = blockDetail.result;
      
      if (block && block.transactions) {
        block.transactions.forEach(tx => {
          if (tx.to && tx.to.toLowerCase() === receiverWallet) {
            const amount = parseFloat(tx.value) / Math.pow(10, 18);
            const tolerance = expectedAmount * 0.01;
            
            if (Math.abs(amount - expectedAmount) <= tolerance) {
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                value: amount,
                blockNumber: blockNum,
                timestamp: parseInt(block.timestamp, 16) * 1000
              });
            }
          }
        });
      }
    }
    
    return {
      found: transactions.length > 0,
      transactions: transactions.slice(0, 10) // Return max 10 matches
    };

  } catch (error) {
    console.error('Payment check error:', error);
    return { found: false, transactions: [] };
  }
}

// Create subscription after payment confirmation
async function createSubscription(paymentSession, txHash) {
  try {
    // Create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .upsert({
        billing_email: paymentSession.customer_email,
        current_plan_id: paymentSession.plan_id,
        subscription_status: 'active',
        billing_interval: paymentSession.billing_interval,
        subscription_start_date: new Date().toISOString(),
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + (
          paymentSession.billing_interval === 'yearly' ? 365 : 30
        ) * 24 * 60 * 60 * 1000).toISOString()
      }, {
        onConflict: 'billing_email'
      })
      .select()
      .single();

    if (orgError) throw orgError;

    // Log billing history
    await supabase
      .from('billing_history')
      .insert({
        organization_id: org.id,
        invoice_number: `INV-${paymentSession.payment_id}`,
        amount: paymentSession.usd_amount,
        currency: 'USD',
        status: 'paid',
        period_start: org.current_period_start,
        period_end: org.current_period_end,
        paid_at: new Date().toISOString(),
        payment_method: `${paymentSession.crypto_symbol} (${getNetworkName(paymentSession.network_id)})`,
        metadata: {
          txHash,
          cryptoAmount: paymentSession.crypto_amount,
          cryptoSymbol: paymentSession.crypto_symbol,
          networkId: paymentSession.network_id
        }
      });

    // Activate subscription features via subscription manager
    await activateSubscriptionFeatures(org.id, paymentSession.plan_id);

    console.log('✅ Subscription created and activated for payment:', paymentSession.payment_id);
    console.log('🎯 Features unlocked for plan:', paymentSession.plan_id);

  } catch (error) {
    console.error('Subscription creation error:', error);
  }
}

// Activate subscription features via subscription manager
async function activateSubscriptionFeatures(organizationId, planId) {
  try {
    // Reset usage tracking for new subscription
    await supabase
      .from('usage_tracking')
      .upsert({
        organization_id: organizationId,
        review_invites_sent: 0,
        review_responses_received: 0,
        ai_sentiment_analyses: 0,
        ai_auto_responses: 0,
        nft_rewards_distributed: 0,
        reset_date: new Date().toISOString()
      }, {
        onConflict: 'organization_id'
      });

    // Create feature access log
    await supabase
      .from('feature_access_logs')
      .insert({
        organization_id: organizationId,
        plan_id: planId,
        features_unlocked: JSON.stringify(getPlanFeatures(planId)),
        activated_at: new Date().toISOString(),
        activation_method: 'crypto_payment'
      });

    console.log(`🚀 Features activated for organization ${organizationId} on plan ${planId}`);

  } catch (error) {
    console.error('Feature activation error:', error);
  }
}

// Get plan features configuration
function getPlanFeatures(planId) {
  const PLANS = {
    free: {
      unlimited_reviews: true,
      ai_automated_responses: false,
      advanced_analytics: false,
      custom_branding: false,
      api_access: false,
      white_label_solution: false,
      priority_support: false,
      nft_rewards: false,
      vr_ar_content: false,
      gamification: false,
      micro_tipping: false,
      insights_marketplace: false
    },
    plus: {
      unlimited_reviews: true,
      ai_automated_responses: true,
      advanced_analytics: true,
      custom_branding: false,
      api_access: false,
      white_label_solution: false,
      priority_support: false,
      nft_rewards: true,
      vr_ar_content: false,
      gamification: true,
      micro_tipping: false,
      insights_marketplace: false
    },
    premium: {
      unlimited_reviews: true,
      ai_automated_responses: true,
      advanced_analytics: true,
      custom_branding: true,
      api_access: true,
      white_label_solution: false,
      priority_support: true,
      nft_rewards: true,
      vr_ar_content: true,
      gamification: true,
      micro_tipping: true,
      insights_marketplace: false
    },
    advanced: {
      unlimited_reviews: true,
      ai_automated_responses: true,
      advanced_analytics: true,
      custom_branding: true,
      api_access: true,
      white_label_solution: true,
      priority_support: true,
      nft_rewards: true,
      vr_ar_content: true,
      gamification: true,
      micro_tipping: true,
      insights_marketplace: true
    },
    enterprise: {
      unlimited_reviews: true,
      ai_automated_responses: true,
      advanced_analytics: true,
      custom_branding: true,
      api_access: true,
      white_label_solution: true,
      priority_support: true,
      nft_rewards: true,
      vr_ar_content: true,
      gamification: true,
      micro_tipping: true,
      insights_marketplace: true
    }
  };
  
  return PLANS[planId] || PLANS.free;
}

// Helper functions
function getRpcUrl(networkId) {
  return {
    1: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    137: 'https://polygon-rpc.com',
    56: 'https://bsc-dataseed1.binance.org'
  }[networkId] || '';
}

function getNetworkName(networkId) {
  return {
    1: 'Ethereum',
    137: 'Polygon', 
    56: 'BSC'
  }[networkId] || 'Unknown';
}