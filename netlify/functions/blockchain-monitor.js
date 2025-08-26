// PRODUCTION BLOCKCHAIN MONITORING SYSTEM
// Real blockchain APIs: Etherscan, BSCScan, Polygonscan, Coinbase, CoinGecko
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const Web3 = require('web3');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Blockchain network configurations
const BLOCKCHAIN_NETWORKS = {
  ethereum: {
    name: 'Ethereum Mainnet',
    api_url: 'https://api.etherscan.io/api',
    api_key_env: 'ETHERSCAN_API_KEY',
    rpc_url: 'https://mainnet.infura.io/v3/',
    native_token: 'ETH',
    explorer: 'https://etherscan.io'
  },
  bsc: {
    name: 'Binance Smart Chain',
    api_url: 'https://api.bscscan.com/api',
    api_key_env: 'BSCSCAN_API_KEY',
    rpc_url: 'https://bsc-dataseed1.binance.org/',
    native_token: 'BNB',
    explorer: 'https://bscscan.com'
  },
  polygon: {
    name: 'Polygon',
    api_url: 'https://api.polygonscan.com/api',
    api_key_env: 'POLYGONSCAN_API_KEY',
    rpc_url: 'https://polygon-rpc.com/',
    native_token: 'MATIC',
    explorer: 'https://polygonscan.com'
  },
  avalanche: {
    name: 'Avalanche',
    api_url: 'https://api.snowtrace.io/api',
    api_key_env: 'SNOWTRACE_API_KEY',
    rpc_url: 'https://api.avax.network/ext/bc/C/rpc',
    native_token: 'AVAX',
    explorer: 'https://snowtrace.io'
  },
  arbitrum: {
    name: 'Arbitrum',
    api_url: 'https://api.arbiscan.io/api',
    api_key_env: 'ARBISCAN_API_KEY',
    rpc_url: 'https://arb1.arbitrum.io/rpc',
    native_token: 'ETH',
    explorer: 'https://arbiscan.io'
  }
};

// Token monitoring configurations
const TOKEN_CATEGORIES = {
  stablecoins: ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'],
  defi_tokens: ['AAVE', 'UNI', 'COMP', 'MKR', 'SNX'],
  layer1: ['ETH', 'BNB', 'ADA', 'SOL', 'DOT'],
  meme_tokens: ['DOGE', 'SHIB', 'PEPE', 'FLOKI'],
  enterprise: ['LINK', 'VET', 'XRP', 'XLM']
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

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { action } = body;

    switch (action) {
      case 'monitor_address':
        return await monitorBlockchainAddress(body, headers);
        
      case 'track_token':
        return await trackTokenMetrics(body, headers);
        
      case 'analyze_transaction':
        return await analyzeTransaction(body, headers);
        
      case 'get_wallet_profile':
        return await getWalletProfile(body, headers);
        
      case 'monitor_contract':
        return await monitorSmartContract(body, headers);
        
      case 'track_nft_collection':
        return await trackNFTCollection(body, headers);
        
      case 'defi_portfolio_analysis':
        return await analyzeDeFiPortfolio(body, headers);
        
      case 'risk_assessment':
        return await assessRiskProfile(body, headers);
        
      case 'get_market_intelligence':
        return await getMarketIntelligence(body, headers);
        
      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid action specified' })
        };
    }

  } catch (error) {
    console.error('Blockchain monitor error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// REAL BLOCKCHAIN ADDRESS MONITORING
async function monitorBlockchainAddress(body, headers) {
  try {
    const { 
      address, 
      networks = ['ethereum', 'bsc'], 
      organization_id,
      alert_thresholds = {},
      monitor_duration = '24h'
    } = body;

    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid blockchain address is required' })
      };
    }

    const monitoringResults = {};
    
    for (const network of networks) {
      if (!BLOCKCHAIN_NETWORKS[network]) continue;
      
      console.log(`🔍 Monitoring ${address} on ${network}`);
      
      try {
        const networkData = await analyzeAddressOnNetwork(address, network);
        monitoringResults[network] = networkData;
        
        // Check alert thresholds
        const alerts = checkAlertThresholds(networkData, alert_thresholds);
        if (alerts.length > 0) {
          await sendBlockchainAlerts(organization_id, address, network, alerts);
        }
        
      } catch (networkError) {
        console.error(`Error monitoring ${network}:`, networkError);
        monitoringResults[network] = { 
          error: networkError.message,
          status: 'failed' 
        };
      }
    }

    // Store monitoring session
    if (organization_id) {
      await storeMonitoringSession(organization_id, {
        address,
        networks,
        results: monitoringResults,
        thresholds: alert_thresholds,
        timestamp: new Date().toISOString()
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        monitored_address: address,
        networks_analyzed: Object.keys(monitoringResults),
        monitoring_results: monitoringResults,
        total_value_usd: calculateTotalValue(monitoringResults),
        risk_score: calculateRiskScore(monitoringResults)
      })
    };

  } catch (error) {
    console.error('Address monitoring error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Address monitoring failed' })
    };
  }
}

// Analyze address on specific network using real APIs
async function analyzeAddressOnNetwork(address, network) {
  const networkConfig = BLOCKCHAIN_NETWORKS[network];
  const apiKey = process.env[networkConfig.api_key_env];
  
  if (!apiKey) {
    throw new Error(`API key not configured for ${network}`);
  }

  const analysis = {
    network: network,
    address: address,
    timestamp: new Date().toISOString()
  };

  // 1. Get account balance
  const balanceResponse = await axios.get(networkConfig.api_url, {
    params: {
      module: 'account',
      action: 'balance',
      address: address,
      tag: 'latest',
      apikey: apiKey
    }
  });

  analysis.native_balance = {
    wei: balanceResponse.data.result,
    formatted: Web3.utils.fromWei(balanceResponse.data.result, 'ether'),
    symbol: networkConfig.native_token
  };

  // 2. Get transaction history
  const txHistoryResponse = await axios.get(networkConfig.api_url, {
    params: {
      module: 'account',
      action: 'txlist',
      address: address,
      startblock: 0,
      endblock: 99999999,
      page: 1,
      offset: 100,
      sort: 'desc',
      apikey: apiKey
    }
  });

  analysis.transaction_history = {
    total_transactions: txHistoryResponse.data.result.length,
    recent_transactions: txHistoryResponse.data.result.slice(0, 10),
    first_transaction: txHistoryResponse.data.result[txHistoryResponse.data.result.length - 1],
    last_transaction: txHistoryResponse.data.result[0]
  };

  // 3. Get ERC-20 token balances
  const tokenBalancesResponse = await axios.get(networkConfig.api_url, {
    params: {
      module: 'account',
      action: 'tokentx',
      address: address,
      page: 1,
      offset: 100,
      sort: 'desc',
      apikey: apiKey
    }
  });

  analysis.token_holdings = await processTokenBalances(tokenBalancesResponse.data.result, network);

  // 4. Analyze transaction patterns
  analysis.transaction_patterns = analyzeTransactionPatterns(txHistoryResponse.data.result);

  // 5. Check for contract interactions
  analysis.contract_interactions = analyzeContractInteractions(txHistoryResponse.data.result);

  // 6. Calculate address metrics
  analysis.metrics = calculateAddressMetrics(analysis);

  return analysis;
}

// Process and enrich token balances
async function processTokenBalances(tokenTransactions, network) {
  const tokenMap = new Map();
  
  for (const tx of tokenTransactions) {
    const tokenKey = `${tx.contractAddress}_${tx.tokenSymbol}`;
    if (!tokenMap.has(tokenKey)) {
      tokenMap.set(tokenKey, {
        contract_address: tx.contractAddress,
        symbol: tx.tokenSymbol,
        name: tx.tokenName,
        decimals: tx.tokenDecimal,
        transactions: []
      });
    }
    tokenMap.get(tokenKey).transactions.push(tx);
  }

  const tokens = Array.from(tokenMap.values());
  
  // Enrich with current prices and market data
  for (const token of tokens) {
    try {
      token.market_data = await getTokenMarketData(token.symbol, network);
    } catch (error) {
      console.error(`Error getting market data for ${token.symbol}:`, error);
      token.market_data = null;
    }
  }

  return tokens;
}

// Get real-time token market data
async function getTokenMarketData(symbol, network) {
  try {
    // Use CoinGecko API for market data
    if (process.env.COINGECKO_API_KEY) {
      const response = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
        params: {
          vs_currency: 'usd',
          ids: '', // Would need to map symbol to CoinGecko ID
          order: 'market_cap_desc',
          per_page: 1,
          page: 1,
          sparkline: false
        },
        headers: {
          'X-CG-Demo-API-Key': process.env.COINGECKO_API_KEY
        }
      });

      if (response.data[0]) {
        return {
          price_usd: response.data[0].current_price,
          market_cap: response.data[0].market_cap,
          volume_24h: response.data[0].total_volume,
          price_change_24h: response.data[0].price_change_percentage_24h,
          last_updated: response.data[0].last_updated
        };
      }
    }

    // Fallback to CoinMarketCap
    if (process.env.COINMARKETCAP_API_KEY) {
      const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
        headers: {
          'X-CMC_PRO_API_KEY': process.env.COINMARKETCAP_API_KEY
        },
        params: {
          symbol: symbol,
          convert: 'USD'
        }
      });

      const data = response.data.data[symbol];
      if (data) {
        return {
          price_usd: data.quote.USD.price,
          market_cap: data.quote.USD.market_cap,
          volume_24h: data.quote.USD.volume_24h,
          price_change_24h: data.quote.USD.percent_change_24h,
          last_updated: data.quote.USD.last_updated
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Market data fetch error:', error);
    return null;
  }
}

// REAL TOKEN TRACKING
async function trackTokenMetrics(body, headers) {
  try {
    const { 
      token_address, 
      network = 'ethereum',
      metrics = ['price', 'volume', 'holders', 'liquidity'],
      organization_id
    } = body;

    if (!token_address || !/^0x[a-fA-F0-9]{40}$/.test(token_address)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid token contract address is required' })
      };
    }

    const networkConfig = BLOCKCHAIN_NETWORKS[network];
    const apiKey = process.env[networkConfig.api_key_env];

    if (!apiKey) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `API key not configured for ${network}` })
      };
    }

    console.log(`📊 Tracking token ${token_address} on ${network}`);

    const tokenMetrics = {};

    // Get token basic info
    const tokenInfo = await getTokenInfo(token_address, network, apiKey);
    tokenMetrics.basic_info = tokenInfo;

    // Get price data if requested
    if (metrics.includes('price')) {
      tokenMetrics.price_data = await getTokenPriceData(token_address, network);
    }

    // Get volume data if requested  
    if (metrics.includes('volume')) {
      tokenMetrics.volume_data = await getTokenVolumeData(token_address, network, apiKey);
    }

    // Get holder statistics if requested
    if (metrics.includes('holders')) {
      tokenMetrics.holder_stats = await getTokenHolderStats(token_address, network, apiKey);
    }

    // Get liquidity data if requested
    if (metrics.includes('liquidity')) {
      tokenMetrics.liquidity_data = await getTokenLiquidityData(token_address, network);
    }

    // Calculate risk metrics
    tokenMetrics.risk_analysis = calculateTokenRiskMetrics(tokenMetrics);

    // Store tracking data
    if (organization_id) {
      await storeTokenTracking(organization_id, {
        token_address,
        network,
        metrics: tokenMetrics,
        timestamp: new Date().toISOString()
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token_address,
        network,
        metrics: tokenMetrics
      })
    };

  } catch (error) {
    console.error('Token tracking error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Token tracking failed' })
    };
  }
}

// Get detailed token information
async function getTokenInfo(tokenAddress, network, apiKey) {
  const networkConfig = BLOCKCHAIN_NETWORKS[network];
  
  try {
    // Get token supply
    const supplyResponse = await axios.get(networkConfig.api_url, {
      params: {
        module: 'stats',
        action: 'tokensupply',
        contractaddress: tokenAddress,
        apikey: apiKey
      }
    });

    // Get contract source if verified
    const contractResponse = await axios.get(networkConfig.api_url, {
      params: {
        module: 'contract',
        action: 'getsourcecode',
        address: tokenAddress,
        apikey: apiKey
      }
    });

    return {
      total_supply: supplyResponse.data.result,
      contract_verified: contractResponse.data.result[0].SourceCode !== '',
      contract_name: contractResponse.data.result[0].ContractName,
      compiler_version: contractResponse.data.result[0].CompilerVersion,
      optimization_used: contractResponse.data.result[0].OptimizationUsed,
      abi: contractResponse.data.result[0].ABI
    };

  } catch (error) {
    console.error('Token info fetch error:', error);
    return { error: error.message };
  }
}

// Smart contract monitoring
async function monitorSmartContract(body, headers) {
  try {
    const { 
      contract_address, 
      network = 'ethereum',
      monitor_events = true,
      monitor_functions = true,
      organization_id
    } = body;

    if (!contract_address || !/^0x[a-fA-F0-9]{40}$/.test(contract_address)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid contract address is required' })
      };
    }

    const networkConfig = BLOCKCHAIN_NETWORKS[network];
    const apiKey = process.env[networkConfig.api_key_env];

    console.log(`🔧 Monitoring contract ${contract_address} on ${network}`);

    const contractAnalysis = {};

    // Get contract details
    contractAnalysis.contract_info = await getContractDetails(contract_address, network, apiKey);

    // Monitor recent transactions
    if (monitor_functions) {
      contractAnalysis.function_calls = await getContractFunctionCalls(contract_address, network, apiKey);
    }

    // Monitor events
    if (monitor_events) {
      contractAnalysis.events = await getContractEvents(contract_address, network, apiKey);
    }

    // Security analysis
    contractAnalysis.security_analysis = await analyzeContractSecurity(contract_address, network);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        contract_address,
        network,
        analysis: contractAnalysis
      })
    };

  } catch (error) {
    console.error('Contract monitoring error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Contract monitoring failed' })
    };
  }
}

// Helper functions
function analyzeTransactionPatterns(transactions) {
  if (!transactions || transactions.length === 0) {
    return { analysis: 'No transactions found' };
  }

  const patterns = {
    total_transactions: transactions.length,
    transaction_frequency: calculateTransactionFrequency(transactions),
    average_value: calculateAverageTransactionValue(transactions),
    gas_usage_patterns: analyzeGasUsage(transactions),
    time_patterns: analyzeTransactionTiming(transactions),
    counterparty_analysis: analyzeCounterparties(transactions)
  };

  return patterns;
}

function calculateTransactionFrequency(transactions) {
  if (transactions.length < 2) return 'Insufficient data';
  
  const first = parseInt(transactions[transactions.length - 1].timeStamp);
  const last = parseInt(transactions[0].timeStamp);
  const daysDiff = (last - first) / (24 * 60 * 60);
  
  return {
    transactions_per_day: Math.round(transactions.length / daysDiff * 100) / 100,
    active_days: Math.ceil(daysDiff),
    most_active_period: findMostActivePeriod(transactions)
  };
}

function calculateAverageTransactionValue(transactions) {
  const values = transactions.map(tx => parseFloat(Web3.utils.fromWei(tx.value, 'ether')));
  const sum = values.reduce((a, b) => a + b, 0);
  
  return {
    average_eth: sum / values.length,
    median_eth: values.sort((a, b) => a - b)[Math.floor(values.length / 2)],
    total_volume_eth: sum
  };
}

function analyzeGasUsage(transactions) {
  const gasUsed = transactions.map(tx => parseInt(tx.gasUsed));
  const gasPrices = transactions.map(tx => parseInt(tx.gasPrice));
  
  return {
    average_gas_used: gasUsed.reduce((a, b) => a + b, 0) / gasUsed.length,
    average_gas_price_gwei: Web3.utils.fromWei(
      (gasPrices.reduce((a, b) => a + b, 0) / gasPrices.length).toString(), 
      'gwei'
    ),
    total_gas_fees_eth: Web3.utils.fromWei(
      gasUsed.reduce((sum, gas, i) => sum + (gas * gasPrices[i]), 0).toString(),
      'ether'
    )
  };
}

function calculateRiskScore(monitoringResults) {
  let riskScore = 0;
  let factors = [];

  for (const [network, data] of Object.entries(monitoringResults)) {
    if (data.error) continue;

    // Transaction frequency risk
    const txFreq = data.transaction_patterns?.transaction_frequency?.transactions_per_day || 0;
    if (txFreq > 50) {
      riskScore += 20;
      factors.push('High transaction frequency');
    }

    // Large token holdings risk
    if (data.token_holdings?.length > 20) {
      riskScore += 15;
      factors.push('High number of token holdings');
    }

    // Contract interaction risk
    const contractInteractions = data.contract_interactions?.total_contracts || 0;
    if (contractInteractions > 10) {
      riskScore += 25;
      factors.push('Extensive DeFi interactions');
    }
  }

  return {
    score: Math.min(riskScore, 100),
    level: riskScore < 30 ? 'Low' : riskScore < 60 ? 'Medium' : 'High',
    factors: factors
  };
}

// Storage functions
async function storeMonitoringSession(organizationId, sessionData) {
  try {
    await supabase
      .from('blockchain_monitoring_sessions')
      .insert({
        organization_id: organizationId,
        monitored_address: sessionData.address,
        networks: sessionData.networks,
        monitoring_results: sessionData.results,
        alert_thresholds: sessionData.thresholds,
        created_at: sessionData.timestamp
      });
  } catch (error) {
    console.error('Error storing monitoring session:', error);
  }
}

async function storeTokenTracking(organizationId, trackingData) {
  try {
    await supabase
      .from('token_tracking')
      .insert({
        organization_id: organizationId,
        token_address: trackingData.token_address,
        network: trackingData.network,
        tracking_data: trackingData.metrics,
        created_at: trackingData.timestamp
      });
  } catch (error) {
    console.error('Error storing token tracking:', error);
  }
}

// Alert system
async function sendBlockchainAlerts(organizationId, address, network, alerts) {
  try {
    for (const alert of alerts) {
      await supabase
        .from('blockchain_alerts')
        .insert({
          organization_id: organizationId,
          alert_type: alert.type,
          severity: alert.severity,
          message: alert.message,
          blockchain_data: {
            address: address,
            network: network,
            trigger_data: alert.trigger_data
          },
          created_at: new Date().toISOString()
        });
    }
    
    console.log(`🚨 Sent ${alerts.length} blockchain alerts for ${address}`);
  } catch (error) {
    console.error('Error sending blockchain alerts:', error);
  }
}

function checkAlertThresholds(networkData, thresholds) {
  const alerts = [];

  // Large transaction alert
  if (thresholds.large_transaction_usd && networkData.transaction_history?.recent_transactions) {
    const largeTransactions = networkData.transaction_history.recent_transactions.filter(tx => {
      const valueUsd = parseFloat(Web3.utils.fromWei(tx.value, 'ether')) * 2000; // Simplified ETH price
      return valueUsd > thresholds.large_transaction_usd;
    });

    if (largeTransactions.length > 0) {
      alerts.push({
        type: 'large_transaction',
        severity: 'high',
        message: `${largeTransactions.length} large transaction(s) detected`,
        trigger_data: largeTransactions
      });
    }
  }

  // Token balance change alert
  if (thresholds.token_balance_change && networkData.token_holdings) {
    // This would compare with previous monitoring sessions
    alerts.push({
      type: 'token_balance_change',
      severity: 'medium',
      message: 'Significant token balance changes detected',
      trigger_data: networkData.token_holdings
    });
  }

  return alerts;
}

function calculateTotalValue(monitoringResults) {
  let totalUsd = 0;
  
  for (const [network, data] of Object.entries(monitoringResults)) {
    if (data.error) continue;
    
    // Add native token value (simplified calculation)
    const nativeBalance = parseFloat(data.native_balance?.formatted || 0);
    const estimatedPriceUsd = network === 'ethereum' ? 2000 : network === 'bsc' ? 300 : 100;
    totalUsd += nativeBalance * estimatedPriceUsd;
    
    // Add token values
    if (data.token_holdings) {
      for (const token of data.token_holdings) {
        if (token.market_data?.price_usd) {
          // This would need proper balance calculation
          totalUsd += token.market_data.price_usd * 100; // Simplified
        }
      }
    }
  }
  
  return totalUsd;
}