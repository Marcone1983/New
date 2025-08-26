// ENTERPRISE CRYPTO SUBSCRIPTION SYSTEM - PRODUCTION BLOCKCHAIN PAYMENTS
// Real-time blockchain payment processing with your wallets
const { createClient } = require('@supabase/supabase-js');
const Web3 = require('web3');
const axios = require('axios');
const crypto = require('crypto');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// YOUR BUSINESS CRYPTO WALLETS - REAL ADDRESSES FOR PAYMENT COLLECTION
const YOUR_BUSINESS_WALLETS = {
  ethereum: {
    address: '0x15315077b2C2bA625bc0bc156415F704208FBd45',
    network: 'Ethereum Mainnet',
    chain_id: 1,
    explorer: 'https://etherscan.io',
    confirmations_required: 12
  },
  bsc: {
    address: '0x15315077b2C2bA625bc0bc156415F704208FBd45', 
    network: 'Binance Smart Chain',
    chain_id: 56,
    explorer: 'https://bscscan.com',
    confirmations_required: 3
  },
  polygon: {
    address: '0x15315077b2C2bA625bc0bc156415F704208FBd45',
    network: 'Polygon',
    chain_id: 137, 
    explorer: 'https://polygonscan.com',
    confirmations_required: 20
  }
};

// ENTERPRISE SUBSCRIPTION PLANS WITH CRYPTO PRICING
const ENTERPRISE_CRYPTO_PLANS = {
  plus: {
    name: 'Plus Enterprise',
    usd_value: 49,
    billing_cycle: 'monthly',
    features: [
      'AI Sentiment Analysis (1,000/month)',
      'Multi-platform Review Monitoring',
      'Basic Dashboard & Analytics',
      'Email Notifications',
      'Response Suggestions AI'
    ],
    limits: {
      sentiment_analyses_monthly: 1000,
      monitored_platforms: 5,
      team_members: 3,
      data_retention_months: 6,
      api_calls_monthly: 1000
    },
    crypto_prices: {
      ETH: '0.0272',    // Dynamic pricing based on current rates
      BNB: '0.245',     // Updated every hour
      MATIC: '65.33',   // Real-time market rates
      USDT: '49.00',    // Stablecoin fixed
      USDC: '49.00',    // Stablecoin fixed
      BTC: '0.00108'    // Bitcoin option
    }
  },
  premium: {
    name: 'Premium Enterprise',
    usd_value: 149,
    billing_cycle: 'monthly',
    features: [
      'Advanced AI Analysis (5,000/month)',
      'Real-time Crisis Detection',
      'Competitor Intelligence',
      'Automated Response Generation', 
      'Priority Support',
      'API Access',
      'Custom Integrations'
    ],
    limits: {
      sentiment_analyses_monthly: 5000,
      monitored_platforms: 15,
      team_members: 10,
      data_retention_months: 12,
      api_calls_monthly: 10000,
      competitors_tracked: 10
    },
    crypto_prices: {
      ETH: '0.0828',    
      BNB: '0.745',     
      MATIC: '198.67',  
      USDT: '149.00',   
      USDC: '149.00',   
      BTC: '0.00329'    
    }
  },
  advanced: {
    name: 'Advanced Enterprise',
    usd_value: 399,
    billing_cycle: 'monthly', 
    features: [
      'Unlimited AI Analysis',
      'Predictive Analytics Suite',
      'White-label Platform',
      'Dedicated Account Manager',
      'Custom AI Training',
      'Enterprise Security (SOC2)',
      'Unlimited API Access',
      'Multi-location Management'
    ],
    limits: {
      sentiment_analyses_monthly: -1, // Unlimited
      monitored_platforms: -1,        // Unlimited
      team_members: -1,               // Unlimited
      data_retention_months: -1,      // Unlimited
      api_calls_monthly: -1,          // Unlimited
      competitors_tracked: -1         // Unlimited
    },
    crypto_prices: {
      ETH: '0.2217',    
      BNB: '1.995',     
      MATIC: '532.00',  
      USDT: '399.00',   
      USDC: '399.00',   
      BTC: '0.00881'    
    }
  }
};

exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    switch (action) {
      case 'get_crypto_plans':
        return await getCryptoSubscriptionPlans(body, headers);
        
      case 'get_payment_wallets':
        return await getBusinessWallets(body, headers);
        
      case 'create_payment_invoice':
        return await createPaymentInvoice(body, headers);
        
      case 'verify_blockchain_payment':
        return await verifyBlockchainPayment(body, headers);
        
      case 'activate_crypto_subscription':
        return await activateCryptoSubscription(body, headers);
        
      case 'check_payment_status':
        return await checkPaymentStatus(body, headers);
        
      case 'get_subscription_status':
        return await getSubscriptionStatus(body, headers);
        
      case 'update_crypto_prices':
        return await updateCryptoPrices(body, headers);

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action' })
        };
    }

  } catch (error) {
    console.error('Enterprise crypto subscription error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// GET CRYPTO SUBSCRIPTION PLANS WITH REAL-TIME PRICING
async function getCryptoSubscriptionPlans(body, headers) {
  try {
    // Update crypto prices in real-time
    const updatedPlans = await updatePlanPricesRealTime();
    
    // Get current crypto market data
    const marketData = await getCryptoMarketData();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        plans: updatedPlans,
        market_data: marketData,
        supported_networks: Object.keys(YOUR_BUSINESS_WALLETS),
        business_wallets: YOUR_BUSINESS_WALLETS,
        last_updated: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Get crypto plans error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get subscription plans' })
    };
  }
}

// GET BUSINESS WALLET ADDRESSES
async function getBusinessWallets(body, headers) {
  try {
    const { network } = body;
    
    if (network && YOUR_BUSINESS_WALLETS[network]) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          wallet: YOUR_BUSINESS_WALLETS[network]
        })
      };
    }
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        wallets: YOUR_BUSINESS_WALLETS
      })
    };

  } catch (error) {
    console.error('Get business wallets error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get wallet addresses' })
    };
  }
}

// CREATE PAYMENT INVOICE
async function createPaymentInvoice(body, headers) {
  try {
    const { 
      plan_type, 
      crypto_currency, 
      network,
      user_email, 
      organization_id 
    } = body;

    if (!plan_type || !crypto_currency || !network || !user_email) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields: plan_type, crypto_currency, network, user_email' 
        })
      };
    }

    const plan = ENTERPRISE_CRYPTO_PLANS[plan_type];
    if (!plan) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan type' })
      };
    }

    const wallet = YOUR_BUSINESS_WALLETS[network];
    if (!wallet) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Network not supported' })
      };
    }

    // Generate unique invoice ID
    const invoiceId = crypto.randomBytes(16).toString('hex');
    
    // Get current crypto price
    const cryptoPrice = await getCurrentCryptoPrice(crypto_currency);
    const requiredAmount = (plan.usd_value / cryptoPrice).toFixed(8);
    
    // Create invoice in database
    const { data: invoice, error } = await supabase
      .from('crypto_payment_invoices')
      .insert({
        invoice_id: invoiceId,
        organization_id: organization_id,
        user_email: user_email,
        plan_type: plan_type,
        crypto_currency: crypto_currency.toUpperCase(),
        network: network,
        required_amount: requiredAmount,
        usd_value: plan.usd_value,
        wallet_address: wallet.address,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min expiry
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        invoice: {
          invoice_id: invoiceId,
          plan_name: plan.name,
          crypto_currency: crypto_currency.toUpperCase(),
          network: wallet.network,
          required_amount: requiredAmount,
          usd_value: plan.usd_value,
          wallet_address: wallet.address,
          expires_at: invoice.expires_at,
          qr_code_data: `${wallet.address}?amount=${requiredAmount}`,
          payment_instructions: `Send exactly ${requiredAmount} ${crypto_currency.toUpperCase()} to ${wallet.address}`,
          confirmations_required: wallet.confirmations_required,
          explorer_url: wallet.explorer
        }
      })
    };

  } catch (error) {
    console.error('Create payment invoice error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create payment invoice' })
    };
  }
}

// VERIFY BLOCKCHAIN PAYMENT
async function verifyBlockchainPayment(body, headers) {
  try {
    const { invoice_id, transaction_hash } = body;

    if (!invoice_id || !transaction_hash) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing invoice_id or transaction_hash' 
        })
      };
    }

    // Get invoice from database
    const { data: invoice, error } = await supabase
      .from('crypto_payment_invoices')
      .select('*')
      .eq('invoice_id', invoice_id)
      .single();

    if (error || !invoice) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Invoice not found' })
      };
    }

    // Check if invoice expired
    if (new Date() > new Date(invoice.expires_at)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invoice has expired' })
      };
    }

    // Verify transaction on blockchain
    const network = invoice.network;
    const wallet = YOUR_BUSINESS_WALLETS[network];
    
    const transactionData = await getBlockchainTransaction(network, transaction_hash);
    
    if (!transactionData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Transaction not found on blockchain' })
      };
    }

    // Validate payment
    const validation = validatePayment(invoice, transactionData, wallet);
    
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Invalid payment',
          reason: validation.reason
        })
      };
    }

    // Update invoice status
    const isConfirmed = transactionData.confirmations >= wallet.confirmations_required;
    
    const { error: updateError } = await supabase
      .from('crypto_payment_invoices')
      .update({
        transaction_hash: transaction_hash,
        status: isConfirmed ? 'confirmed' : 'pending_confirmation',
        confirmed_at: isConfirmed ? new Date().toISOString() : null,
        actual_amount_received: transactionData.value,
        confirmations: transactionData.confirmations
      })
      .eq('invoice_id', invoice_id);

    if (updateError) throw updateError;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        payment_verification: {
          invoice_id: invoice_id,
          transaction_hash: transaction_hash,
          status: isConfirmed ? 'confirmed' : 'pending_confirmation',
          confirmations: transactionData.confirmations,
          required_confirmations: wallet.confirmations_required,
          amount_received: transactionData.value,
          amount_required: invoice.required_amount,
          network: wallet.network,
          confirmed: isConfirmed
        }
      })
    };

  } catch (error) {
    console.error('Verify blockchain payment error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Payment verification failed' })
    };
  }
}

// ACTIVATE CRYPTO SUBSCRIPTION
async function activateCryptoSubscription(body, headers) {
  try {
    const { invoice_id } = body;

    // Get confirmed invoice
    const { data: invoice, error } = await supabase
      .from('crypto_payment_invoices')
      .select('*')
      .eq('invoice_id', invoice_id)
      .eq('status', 'confirmed')
      .single();

    if (error || !invoice) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Confirmed payment not found' })
      };
    }

    // Get plan details
    const plan = ENTERPRISE_CRYPTO_PLANS[invoice.plan_type];
    
    // Calculate subscription period
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from('crypto_subscriptions')
      .upsert({
        organization_id: invoice.organization_id,
        user_email: invoice.user_email,
        plan_type: invoice.plan_type,
        status: 'active',
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        invoice_id: invoice_id,
        crypto_currency: invoice.crypto_currency,
        network: invoice.network,
        amount_paid: invoice.actual_amount_received,
        usd_value: invoice.usd_value,
        transaction_hash: invoice.transaction_hash,
        wallet_address: invoice.wallet_address
      })
      .select()
      .single();

    if (subError) throw subError;

    // Update organization limits
    await updateOrganizationSubscription(invoice.organization_id, plan);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        subscription: {
          subscription_id: subscription.id,
          plan_type: subscription.plan_type,
          plan_name: plan.name,
          status: subscription.status,
          starts_at: subscription.starts_at,
          expires_at: subscription.expires_at,
          features: plan.features,
          limits: plan.limits
        }
      })
    };

  } catch (error) {
    console.error('Activate crypto subscription error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to activate subscription' })
    };
  }
}

// HELPER FUNCTIONS

async function updatePlanPricesRealTime() {
  try {
    const prices = await getCurrentCryptoPrices();
    
    const updatedPlans = { ...ENTERPRISE_CRYPTO_PLANS };
    
    for (const [planKey, plan] of Object.entries(updatedPlans)) {
      for (const [crypto, _] of Object.entries(plan.crypto_prices)) {
        if (prices[crypto] && crypto !== 'USDT' && crypto !== 'USDC') {
          updatedPlans[planKey].crypto_prices[crypto] = 
            (plan.usd_value / prices[crypto]).toFixed(6);
        }
      }
    }
    
    return updatedPlans;
  } catch (error) {
    console.error('Error updating plan prices:', error);
    return ENTERPRISE_CRYPTO_PLANS;
  }
}

async function getCurrentCryptoPrices() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'ethereum,binancecoin,matic-network,avalanche-2,bitcoin,tether,usd-coin',
        vs_currencies: 'usd'
      }
    });

    return {
      ETH: response.data.ethereum.usd,
      BNB: response.data.binancecoin.usd,
      MATIC: response.data['matic-network'].usd,
      AVAX: response.data['avalanche-2'].usd,
      BTC: response.data.bitcoin.usd,
      USDT: 1.00,
      USDC: 1.00
    };
  } catch (error) {
    console.error('Error fetching crypto prices:', error);
    return {
      ETH: 1800, BNB: 200, MATIC: 0.75, AVAX: 14, BTC: 45000, USDT: 1, USDC: 1
    };
  }
}

async function getCurrentCryptoPrice(currency) {
  const prices = await getCurrentCryptoPrices();
  return prices[currency.toUpperCase()] || 0;
}

async function getCryptoMarketData() {
  try {
    const response = await axios.get('https://api.coingecko.com/api/v3/global');
    return {
      total_market_cap_usd: response.data.data.total_market_cap.usd,
      total_volume_24h_usd: response.data.data.total_volume.usd,
      bitcoin_dominance: response.data.data.market_cap_percentage.btc,
      active_cryptocurrencies: response.data.data.active_cryptocurrencies
    };
  } catch (error) {
    console.error('Error fetching market data:', error);
    return null;
  }
}

async function getBlockchainTransaction(network, txHash) {
  try {
    const wallet = YOUR_BUSINESS_WALLETS[network];
    
    // Use appropriate blockchain API based on network
    let apiUrl, apiParams;
    
    switch (network) {
      case 'ethereum':
        apiUrl = 'https://api.etherscan.io/api';
        apiParams = {
          module: 'proxy',
          action: 'eth_getTransactionByHash',
          txhash: txHash,
          apikey: process.env.ETHERSCAN_API_KEY
        };
        break;
      case 'bsc':
        apiUrl = 'https://api.bscscan.com/api';
        apiParams = {
          module: 'proxy',
          action: 'eth_getTransactionByHash', 
          txhash: txHash,
          apikey: process.env.BSCSCAN_API_KEY
        };
        break;
      case 'polygon':
        apiUrl = 'https://api.polygonscan.com/api';
        apiParams = {
          module: 'proxy',
          action: 'eth_getTransactionByHash',
          txhash: txHash,
          apikey: process.env.POLYGONSCAN_API_KEY
        };
        break;
      default:
        throw new Error('Unsupported network');
    }
    
    const response = await axios.get(apiUrl, { params: apiParams });
    
    if (response.data.result) {
      const tx = response.data.result;
      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: Web3.utils.fromWei(tx.value, 'ether'),
        confirmations: tx.blockNumber ? await getConfirmationCount(network, tx.blockNumber) : 0,
        status: tx.blockNumber ? 'confirmed' : 'pending'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting blockchain transaction:', error);
    return null;
  }
}

async function getConfirmationCount(network, blockNumber) {
  try {
    const wallet = YOUR_BUSINESS_WALLETS[network];
    
    let rpcUrl;
    switch (network) {
      case 'ethereum':
        rpcUrl = `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID}`;
        break;
      case 'bsc': 
        rpcUrl = 'https://bsc-dataseed1.binance.org/';
        break;
      case 'polygon':
        rpcUrl = 'https://polygon-rpc.com/';
        break;
      default:
        return 0;
    }
    
    const web3 = new Web3(rpcUrl);
    const currentBlock = await web3.eth.getBlockNumber();
    return Math.max(0, currentBlock - parseInt(blockNumber));
  } catch (error) {
    console.error('Error getting confirmation count:', error);
    return 0;
  }
}

function validatePayment(invoice, transactionData, wallet) {
  // Check if payment was sent to correct address
  if (transactionData.to.toLowerCase() !== wallet.address.toLowerCase()) {
    return { 
      valid: false, 
      reason: `Payment sent to wrong address. Expected: ${wallet.address}, Got: ${transactionData.to}` 
    };
  }

  // Check if amount is sufficient (allow 5% tolerance)
  const requiredAmount = parseFloat(invoice.required_amount);
  const actualAmount = parseFloat(transactionData.value);
  const tolerance = requiredAmount * 0.05;

  if (actualAmount < (requiredAmount - tolerance)) {
    return { 
      valid: false, 
      reason: `Insufficient amount. Required: ${requiredAmount}, Received: ${actualAmount}` 
    };
  }

  return { valid: true, reason: 'Payment is valid' };
}

async function updateOrganizationSubscription(organizationId, plan) {
  const { error } = await supabase
    .from('organizations')
    .update({
      subscription_plan: plan.name,
      subscription_limits: plan.limits,
      subscription_features: plan.features,
      updated_at: new Date().toISOString()
    })
    .eq('id', organizationId);

  if (error) {
    console.error('Error updating organization subscription:', error);
  }
}