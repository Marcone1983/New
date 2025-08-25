// Netlify Function: Create Crypto Payment Session
// Multi-chain cryptocurrency payment processing

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

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
    const { 
      planId, 
      billingInterval, 
      customerEmail,
      selectedNetwork,
      selectedToken 
    } = JSON.parse(event.body);

    console.log('🚀 Creating crypto payment session:', {
      planId,
      billingInterval,
      selectedNetwork,
      selectedToken
    });

    // Get plan pricing
    const planPricing = getPlanPricing(planId, billingInterval);
    if (!planPricing) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid plan or billing interval' })
      };
    }

    // Get current crypto prices
    const cryptoPrice = await getCryptoPrice(selectedToken, selectedNetwork);
    if (!cryptoPrice) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Unable to fetch crypto price' })
      };
    }

    // Calculate payment amount in crypto
    const usdAmount = planPricing.price;
    const cryptoAmount = usdAmount / cryptoPrice.usd;
    
    // Generate unique payment ID
    const paymentId = generatePaymentId();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Create payment session in database
    const { data: paymentSession, error } = await supabase
      .from('crypto_payment_sessions')
      .insert({
        payment_id: paymentId,
        plan_id: planId,
        billing_interval: billingInterval,
        customer_email: customerEmail,
        
        // Pricing
        usd_amount: usdAmount,
        crypto_amount: cryptoAmount,
        crypto_symbol: selectedToken,
        network_id: selectedNetwork,
        crypto_price_usd: cryptoPrice.usd,
        
        // Payment details
        receiver_wallet: process.env.CRYPTO_PAYMENT_WALLET || '0xC69088eB5F015Fca5B385b8E3A0463749813093e',
        status: 'pending',
        expires_at: expiresAt.toISOString(),
        
        // Metadata
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('✅ Payment session created:', paymentId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        paymentSession: {
          paymentId,
          planName: getPlanName(planId),
          
          // Amounts
          usdAmount,
          cryptoAmount: parseFloat(cryptoAmount.toFixed(8)),
          cryptoSymbol: selectedToken,
          
          // Payment details
          receiverWallet: paymentSession.receiver_wallet,
          networkId: selectedNetwork,
          networkName: getNetworkName(selectedNetwork),
          
          // Timing
          expiresAt: expiresAt.toISOString(),
          timeoutMinutes: 30,
          
          // Instructions
          instructions: generatePaymentInstructions(selectedNetwork, selectedToken),
          explorerUrl: getExplorerUrl(selectedNetwork)
        }
      })
    };

  } catch (error) {
    console.error('❌ Crypto payment creation error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Failed to create payment session',
        message: error.message
      })
    };
  }
};

// Helper functions
function getPlanPricing(planId, interval) {
  const pricing = {
    plus: { monthly: 99, yearly: 990 },
    premium: { monthly: 249, yearly: 2490 },
    advanced: { monthly: 499, yearly: 4990 }
  };
  
  return pricing[planId] ? { price: pricing[planId][interval] } : null;
}

async function getCryptoPrice(token, networkId) {
  try {
    // Use CoinGecko API for live prices
    const coinIds = {
      'ETH': 'ethereum',
      'POL': 'polygon',
      'BNB': 'binancecoin',
      'USDC': 'usd-coin',
      'USDT': 'tether'
    };
    
    const coinId = coinIds[token];
    if (!coinId) return null;
    
    const response = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`
    );
    
    const data = await response.json();
    return { usd: data[coinId]?.usd || 1 };
    
  } catch (error) {
    console.error('Price fetch error:', error);
    // Fallback prices
    return {
      'ETH': { usd: 3200 },
      'POL': { usd: 1.2 },
      'BNB': { usd: 600 },
      'USDC': { usd: 1 },
      'USDT': { usd: 1 }
    }[token] || { usd: 1 };
  }
}

function generatePaymentId() {
  return 'pay_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function getPlanName(planId) {
  return {
    plus: 'Plus (Growth)',
    premium: 'Premium (Professional)', 
    advanced: 'Advanced (Enterprise Ready)'
  }[planId] || planId;
}

function getNetworkName(networkId) {
  return {
    1: 'Ethereum',
    137: 'Polygon',
    56: 'BSC (Binance Smart Chain)'
  }[networkId] || 'Unknown Network';
}

function getExplorerUrl(networkId) {
  return {
    1: 'https://etherscan.io',
    137: 'https://polygonscan.com',
    56: 'https://bscscan.com'
  }[networkId] || '';
}

function generatePaymentInstructions(networkId, token) {
  const networkName = getNetworkName(networkId);
  
  return [
    `1. Assicurati di essere su ${networkName}`,
    `2. Invia esattamente l'importo di ${token} specificato`,
    `3. Usa l'indirizzo wallet fornito come destinazione`,
    `4. Il pagamento sarà confermato automaticamente dopo le conferme blockchain`,
    `5. Riceverai una email di conferma una volta completato`
  ];
}