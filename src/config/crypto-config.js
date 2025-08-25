/**
 * Cryptocurrency Payment Configuration
 * Multi-chain payment system for SocialTrust Enterprise
 */

const PAYMENT_WALLET = '0xC69088eB5F015Fca5B385b8E3A0463749813093e';

const SUPPORTED_NETWORKS = {
  ETHEREUM: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://etherscan.io',
    tokens: {
      ETH: {
        symbol: 'ETH',
        decimals: 18,
        address: null, // Native token
        icon: '🔷'
      },
      USDC: {
        symbol: 'USDC',
        decimals: 6,
        address: '0xA0b86a33E6417C00A3c5E3c3E0B76B8fC7Dc7e8B',
        icon: '💵'
      },
      USDT: {
        symbol: 'USDT', 
        decimals: 6,
        address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        icon: '💰'
      }
    }
  },
  
  POLYGON: {
    id: 137,
    name: 'Polygon',
    symbol: 'POL',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    tokens: {
      POL: {
        symbol: 'POL',
        decimals: 18,
        address: null, // Native token
        icon: '🟣'
      },
      USDC: {
        symbol: 'USDC',
        decimals: 6,
        address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        icon: '💵'
      },
      USDT: {
        symbol: 'USDT',
        decimals: 6,
        address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        icon: '💰'
      }
    }
  },

  BSC: {
    id: 56,
    name: 'BSC (Binance Smart Chain)',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    explorerUrl: 'https://bscscan.com',
    tokens: {
      BNB: {
        symbol: 'BNB',
        decimals: 18,
        address: null, // Native token
        icon: '🟡'
      },
      USDC: {
        symbol: 'USDC',
        decimals: 18,
        address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        icon: '💵'
      },
      USDT: {
        symbol: 'USDT',
        decimals: 18,
        address: '0x55d398326f99059fF775485246999027B3197955',
        icon: '💰'
      }
    }
  }
};

// Plan pricing in USD (converted to crypto dynamically)
const CRYPTO_PRICING = {
  plus: {
    monthly: 99,
    yearly: 990
  },
  premium: {
    monthly: 249,
    yearly: 2490
  },
  advanced: {
    monthly: 499,
    yearly: 4990
  }
};

// Payment configuration
const PAYMENT_CONFIG = {
  receiverWallet: PAYMENT_WALLET,
  confirmationsRequired: {
    [SUPPORTED_NETWORKS.ETHEREUM.id]: 12, // ~3 minutes on Ethereum
    [SUPPORTED_NETWORKS.POLYGON.id]: 20,  // ~1 minute on Polygon
    [SUPPORTED_NETWORKS.BSC.id]: 15       // ~45 seconds on BSC
  },
  
  // Payment timeout (30 minutes)
  paymentTimeoutMs: 30 * 60 * 1000,
  
  // Minimum payment amounts (in USD)
  minimumPayment: 1,
  
  // Gas estimation multipliers
  gasMultipliers: {
    [SUPPORTED_NETWORKS.ETHEREUM.id]: 1.2,
    [SUPPORTED_NETWORKS.POLYGON.id]: 1.1,
    [SUPPORTED_NETWORKS.BSC.id]: 1.1
  }
};

// ERC-20 ABI for token transfers
const ERC20_ABI = [
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  }
];

module.exports = {
  PAYMENT_WALLET,
  SUPPORTED_NETWORKS,
  CRYPTO_PRICING,
  PAYMENT_CONFIG,
  ERC20_ABI,
  
  // Utility functions
  getNetworkById: (networkId) => {
    return Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId);
  },
  
  getTokenByAddress: (networkId, tokenAddress) => {
    const network = Object.values(SUPPORTED_NETWORKS).find(n => n.id === networkId);
    if (!network) return null;
    
    return Object.values(network.tokens).find(t => 
      t.address && t.address.toLowerCase() === tokenAddress.toLowerCase()
    );
  },
  
  formatCryptoAmount: (amount, decimals) => {
    return (amount / Math.pow(10, decimals)).toFixed(6);
  },
  
  parseCryptoAmount: (amount, decimals) => {
    return Math.floor(amount * Math.pow(10, decimals));
  }
};