-- ENTERPRISE CRYPTO PAYMENT SYSTEM DATABASE SCHEMA
-- Production-grade blockchain payment processing tables

-- =============================================
-- CRYPTO PAYMENT INVOICES
-- =============================================
CREATE TABLE IF NOT EXISTS crypto_payment_invoices (
  id SERIAL PRIMARY KEY,
  invoice_id VARCHAR(32) UNIQUE NOT NULL,
  organization_id VARCHAR(50) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  
  -- Plan & Payment Details
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('plus', 'premium', 'advanced')),
  crypto_currency VARCHAR(10) NOT NULL,
  network VARCHAR(20) NOT NULL,
  required_amount DECIMAL(20,8) NOT NULL,
  actual_amount_received DECIMAL(20,8),
  usd_value DECIMAL(10,2) NOT NULL,
  
  -- Blockchain Details
  wallet_address VARCHAR(42) NOT NULL,
  transaction_hash VARCHAR(66),
  confirmations INTEGER DEFAULT 0,
  
  -- Status & Timing
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'pending_confirmation', 'confirmed', 'expired', 'failed')),
  expires_at TIMESTAMP NOT NULL,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_expires_at (expires_at)
);

-- =============================================
-- CRYPTO SUBSCRIPTIONS
-- =============================================
CREATE TABLE IF NOT EXISTS crypto_subscriptions (
  id SERIAL PRIMARY KEY,
  subscription_id VARCHAR(32) UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  organization_id VARCHAR(50) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  
  -- Subscription Details
  plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('plus', 'premium', 'advanced')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'suspended')),
  
  -- Payment Details
  invoice_id VARCHAR(32) REFERENCES crypto_payment_invoices(invoice_id),
  crypto_currency VARCHAR(10) NOT NULL,
  network VARCHAR(20) NOT NULL,
  amount_paid DECIMAL(20,8) NOT NULL,
  usd_value DECIMAL(10,2) NOT NULL,
  transaction_hash VARCHAR(66) NOT NULL,
  wallet_address VARCHAR(42) NOT NULL,
  
  -- Subscription Period
  starts_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  renewed_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  
  -- Usage Tracking
  usage_data JSONB DEFAULT '{}',
  limits_data JSONB DEFAULT '{}',
  features_data JSONB DEFAULT '{}',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for performance
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_organization_id (organization_id),
  INDEX idx_user_email (user_email),
  INDEX idx_status (status),
  INDEX idx_expires_at (expires_at),
  INDEX idx_transaction_hash (transaction_hash)
);

-- =============================================
-- BLOCKCHAIN TRANSACTION MONITORING
-- =============================================
CREATE TABLE IF NOT EXISTS blockchain_transactions (
  id SERIAL PRIMARY KEY,
  transaction_hash VARCHAR(66) UNIQUE NOT NULL,
  network VARCHAR(20) NOT NULL,
  
  -- Transaction Details
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  crypto_currency VARCHAR(10) NOT NULL,
  
  -- Blockchain Status
  block_number BIGINT,
  block_hash VARCHAR(66),
  confirmations INTEGER DEFAULT 0,
  gas_used BIGINT,
  gas_price DECIMAL(20,8),
  transaction_fee DECIMAL(20,8),
  
  -- Business Context
  invoice_id VARCHAR(32) REFERENCES crypto_payment_invoices(invoice_id),
  purpose VARCHAR(50) NOT NULL DEFAULT 'subscription_payment',
  
  -- Status & Timing
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  detected_at TIMESTAMP DEFAULT NOW(),
  confirmed_at TIMESTAMP,
  
  -- Metadata
  raw_transaction_data JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for monitoring
  INDEX idx_transaction_hash (transaction_hash),
  INDEX idx_network (network),
  INDEX idx_to_address (to_address),
  INDEX idx_from_address (from_address),
  INDEX idx_status (status),
  INDEX idx_block_number (block_number),
  INDEX idx_detected_at (detected_at)
);

-- =============================================
-- CRYPTO PRICE HISTORY
-- =============================================
CREATE TABLE IF NOT EXISTS crypto_price_history (
  id SERIAL PRIMARY KEY,
  crypto_currency VARCHAR(10) NOT NULL,
  usd_price DECIMAL(15,8) NOT NULL,
  market_cap DECIMAL(20,2),
  volume_24h DECIMAL(20,2),
  price_change_24h DECIMAL(8,4),
  
  -- Data Source
  source VARCHAR(20) NOT NULL DEFAULT 'coingecko',
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for price tracking
  INDEX idx_crypto_currency (crypto_currency),
  INDEX idx_created_at (created_at),
  UNIQUE INDEX idx_crypto_currency_timestamp (crypto_currency, created_at)
);

-- =============================================
-- WALLET MONITORING
-- =============================================
CREATE TABLE IF NOT EXISTS business_wallet_monitoring (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  network VARCHAR(20) NOT NULL,
  
  -- Wallet Details
  wallet_name VARCHAR(100),
  purpose VARCHAR(50) NOT NULL DEFAULT 'subscription_payments',
  
  -- Balance Tracking
  current_balance DECIMAL(20,8) DEFAULT 0,
  last_balance_check TIMESTAMP,
  
  -- Activity Tracking
  total_received DECIMAL(20,8) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  last_transaction_hash VARCHAR(66),
  last_transaction_at TIMESTAMP,
  
  -- Monitoring Settings
  monitoring_enabled BOOLEAN DEFAULT true,
  alert_threshold DECIMAL(20,8) DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for wallet monitoring
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_network (network),
  INDEX idx_monitoring_enabled (monitoring_enabled),
  UNIQUE INDEX idx_wallet_network (wallet_address, network)
);

-- =============================================
-- SUBSCRIPTION ANALYTICS
-- =============================================
CREATE TABLE IF NOT EXISTS subscription_analytics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  
  -- Plan Distribution
  plus_subscriptions INTEGER DEFAULT 0,
  premium_subscriptions INTEGER DEFAULT 0,
  advanced_subscriptions INTEGER DEFAULT 0,
  total_active_subscriptions INTEGER DEFAULT 0,
  
  -- Revenue Analytics
  daily_revenue_usd DECIMAL(12,2) DEFAULT 0,
  daily_revenue_eth DECIMAL(20,8) DEFAULT 0,
  daily_revenue_bnb DECIMAL(20,8) DEFAULT 0,
  daily_revenue_matic DECIMAL(20,8) DEFAULT 0,
  daily_revenue_avax DECIMAL(20,8) DEFAULT 0,
  
  -- Conversion Analytics
  new_subscriptions INTEGER DEFAULT 0,
  renewals INTEGER DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  churn_rate DECIMAL(5,2) DEFAULT 0,
  
  -- Payment Method Distribution
  eth_payments INTEGER DEFAULT 0,
  bnb_payments INTEGER DEFAULT 0,
  matic_payments INTEGER DEFAULT 0,
  avax_payments INTEGER DEFAULT 0,
  stablecoin_payments INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for analytics
  INDEX idx_date (date),
  UNIQUE INDEX idx_unique_date (date)
);

-- =============================================
-- AUDIT LOGS FOR PAYMENTS
-- =============================================
CREATE TABLE IF NOT EXISTS crypto_payment_audit_logs (
  id SERIAL PRIMARY KEY,
  invoice_id VARCHAR(32),
  subscription_id VARCHAR(32),
  
  -- Event Details
  event_type VARCHAR(50) NOT NULL,
  event_description TEXT,
  
  -- User Context
  user_email VARCHAR(255),
  organization_id VARCHAR(50),
  ip_address INET,
  user_agent TEXT,
  
  -- System Context
  function_name VARCHAR(100),
  request_data JSONB,
  response_data JSONB,
  
  -- Status & Timing
  status VARCHAR(20) NOT NULL,
  processing_time_ms INTEGER,
  error_details JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Indexes for audit trails
  INDEX idx_invoice_id (invoice_id),
  INDEX idx_subscription_id (subscription_id),
  INDEX idx_event_type (event_type),
  INDEX idx_user_email (user_email),
  INDEX idx_organization_id (organization_id),
  INDEX idx_created_at (created_at)
);

-- =============================================
-- AUTOMATIC TRIGGERS FOR DATA INTEGRITY
-- =============================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER update_crypto_payment_invoices_updated_at
  BEFORE UPDATE ON crypto_payment_invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crypto_subscriptions_updated_at
  BEFORE UPDATE ON crypto_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blockchain_transactions_updated_at
  BEFORE UPDATE ON blockchain_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_wallet_monitoring_updated_at
  BEFORE UPDATE ON business_wallet_monitoring
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- VIEWS FOR BUSINESS INTELLIGENCE
-- =============================================

-- Active subscriptions overview
CREATE OR REPLACE VIEW active_crypto_subscriptions AS
SELECT 
  cs.*,
  cpi.crypto_currency,
  cpi.network,
  cpi.wallet_address,
  DATE_PART('day', cs.expires_at - NOW()) as days_until_expiry,
  CASE 
    WHEN cs.expires_at < NOW() THEN 'expired'
    WHEN cs.expires_at < NOW() + INTERVAL '7 days' THEN 'expiring_soon'
    ELSE 'active'
  END as subscription_health
FROM crypto_subscriptions cs
JOIN crypto_payment_invoices cpi ON cs.invoice_id = cpi.invoice_id
WHERE cs.status = 'active';

-- Payment processing metrics
CREATE OR REPLACE VIEW payment_processing_metrics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_invoices,
  COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_payments,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_payments,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_payments,
  SUM(usd_value) as total_usd_value,
  AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))/60) as avg_confirmation_time_minutes
FROM crypto_payment_invoices
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- Wallet activity summary  
CREATE OR REPLACE VIEW wallet_activity_summary AS
SELECT 
  bwm.wallet_address,
  bwm.network,
  bwm.current_balance,
  bwm.total_received,
  bwm.total_transactions,
  COUNT(bt.id) as recent_transactions_24h,
  SUM(bt.amount) as volume_24h
FROM business_wallet_monitoring bwm
LEFT JOIN blockchain_transactions bt ON bwm.wallet_address = bt.to_address
  AND bt.detected_at >= NOW() - INTERVAL '24 hours'
GROUP BY bwm.wallet_address, bwm.network, bwm.current_balance, bwm.total_received, bwm.total_transactions;

-- =============================================
-- PERFORMANCE OPTIMIZATIONS
-- =============================================

-- Partition crypto_payment_invoices by creation month for scalability
-- CREATE TABLE crypto_payment_invoices_y2024m01 PARTITION OF crypto_payment_invoices
-- FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Index for fast invoice lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoice_org_status 
ON crypto_payment_invoices (organization_id, status, created_at DESC);

-- Index for subscription expiry monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscription_expiry 
ON crypto_subscriptions (expires_at) 
WHERE status = 'active';

-- Index for transaction monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_monitoring 
ON blockchain_transactions (to_address, status, detected_at DESC);

-- =============================================
-- INITIAL DATA SEEDING
-- =============================================

-- Insert business wallet addresses for monitoring
INSERT INTO business_wallet_monitoring (wallet_address, network, wallet_name, purpose) VALUES
('0x15315077b2C2bA625bc0bc156415F704208FBd45', 'ethereum', 'Main ETH Wallet', 'subscription_payments'),
('0x15315077b2C2bA625bc0bc156415F704208FBd45', 'bsc', 'Main BSC Wallet', 'subscription_payments'),
('0x15315077b2C2bA625bc0bc156415F704208FBd45', 'polygon', 'Main Polygon Wallet', 'subscription_payments')
ON CONFLICT (wallet_address, network) DO NOTHING;

-- Grant permissions for application user
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;