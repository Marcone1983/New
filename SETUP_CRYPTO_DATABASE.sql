-- CRYPTOCURRENCY PAYMENT DATABASE SCHEMA
-- Execute in Supabase SQL Editor for crypto payment system

-- Crypto payment sessions table
CREATE TABLE IF NOT EXISTS crypto_payment_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id TEXT UNIQUE NOT NULL,
  
  -- Plan details
  plan_id TEXT NOT NULL,
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly')) NOT NULL,
  customer_email TEXT NOT NULL,
  
  -- Payment amounts
  usd_amount DECIMAL(10,2) NOT NULL,
  crypto_amount DECIMAL(30,18) NOT NULL,
  crypto_symbol TEXT NOT NULL,
  network_id INTEGER NOT NULL,
  crypto_price_usd DECIMAL(15,8) NOT NULL,
  
  -- Wallet details
  receiver_wallet TEXT NOT NULL,
  sender_wallet TEXT,
  
  -- Transaction details
  tx_hash TEXT,
  block_number BIGINT,
  confirmations INTEGER DEFAULT 0,
  
  -- Status and timing
  status TEXT CHECK (status IN ('pending', 'confirmed', 'expired', 'failed')) DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_network CHECK (network_id IN (1, 137, 56)), -- Ethereum, Polygon, BSC
  CONSTRAINT valid_crypto CHECK (crypto_symbol IN ('ETH', 'POL', 'BNB', 'USDC', 'USDT')),
  CONSTRAINT positive_amounts CHECK (usd_amount > 0 AND crypto_amount > 0)
);

-- Crypto transaction logs (for audit and analytics)
CREATE TABLE IF NOT EXISTS crypto_transaction_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_session_id UUID REFERENCES crypto_payment_sessions(id) ON DELETE CASCADE,
  
  -- Transaction details
  tx_hash TEXT NOT NULL,
  block_number BIGINT NOT NULL,
  block_timestamp TIMESTAMP WITH TIME ZONE,
  
  -- Network info
  network_id INTEGER NOT NULL,
  network_name TEXT NOT NULL,
  
  -- Amount details
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount DECIMAL(30,18) NOT NULL,
  token_symbol TEXT NOT NULL,
  token_address TEXT, -- NULL for native tokens
  
  -- Gas details
  gas_used BIGINT,
  gas_price DECIMAL(30,18),
  gas_cost DECIMAL(30,18),
  
  -- Verification status
  verification_status TEXT CHECK (verification_status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending',
  confirmations INTEGER DEFAULT 0,
  
  -- Metadata
  raw_transaction JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(tx_hash, network_id)
);

-- Crypto price history (for analytics and tax reporting)
CREATE TABLE IF NOT EXISTS crypto_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  crypto_symbol TEXT NOT NULL,
  network_id INTEGER NOT NULL,
  price_usd DECIMAL(15,8) NOT NULL,
  
  -- Source info
  price_source TEXT DEFAULT 'coingecko',
  
  -- Timing
  price_timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(crypto_symbol, network_id, price_timestamp)
);

-- Wallet monitoring (track payments to our wallets)
CREATE TABLE IF NOT EXISTS wallet_monitoring (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  wallet_address TEXT NOT NULL,
  network_id INTEGER NOT NULL,
  
  -- Monitoring config
  is_active BOOLEAN DEFAULT true,
  last_checked_block BIGINT DEFAULT 0,
  
  -- Stats
  total_received DECIMAL(30,18) DEFAULT 0,
  transaction_count INTEGER DEFAULT 0,
  
  -- Metadata
  wallet_label TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(wallet_address, network_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_crypto_sessions_payment_id ON crypto_payment_sessions(payment_id);
CREATE INDEX IF NOT EXISTS idx_crypto_sessions_status ON crypto_payment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_crypto_sessions_expires_at ON crypto_payment_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_crypto_sessions_customer_email ON crypto_payment_sessions(customer_email);
CREATE INDEX IF NOT EXISTS idx_crypto_sessions_created_at ON crypto_payment_sessions(created_at);

CREATE INDEX IF NOT EXISTS idx_crypto_tx_logs_payment_session ON crypto_transaction_logs(payment_session_id);
CREATE INDEX IF NOT EXISTS idx_crypto_tx_logs_tx_hash ON crypto_transaction_logs(tx_hash);
CREATE INDEX IF NOT EXISTS idx_crypto_tx_logs_network ON crypto_transaction_logs(network_id);
CREATE INDEX IF NOT EXISTS idx_crypto_tx_logs_addresses ON crypto_transaction_logs(from_address, to_address);

CREATE INDEX IF NOT EXISTS idx_crypto_price_symbol_network ON crypto_price_history(crypto_symbol, network_id);
CREATE INDEX IF NOT EXISTS idx_crypto_price_timestamp ON crypto_price_history(price_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_monitoring_address ON wallet_monitoring(wallet_address, network_id);

-- Enable Row Level Security
ALTER TABLE crypto_payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE crypto_transaction_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_monitoring ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crypto payment sessions
CREATE POLICY "Users can view their payment sessions" ON crypto_payment_sessions
  FOR SELECT USING (customer_email = auth.jwt() ->> 'email');

CREATE POLICY "System can manage all payment sessions" ON crypto_payment_sessions
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for transaction logs (admin only)
CREATE POLICY "Admin can view transaction logs" ON crypto_transaction_logs
  FOR SELECT USING (auth.role() = 'service_role');

-- Create updated_at trigger for crypto_payment_sessions
DROP TRIGGER IF EXISTS update_crypto_sessions_updated_at ON crypto_payment_sessions;
CREATE TRIGGER update_crypto_sessions_updated_at
    BEFORE UPDATE ON crypto_payment_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert our wallet for monitoring
INSERT INTO wallet_monitoring (
  wallet_address,
  network_id,
  is_active,
  wallet_label
) VALUES 
('0xC69088eB5F015Fca5B385b8E3A0463749813093e', 1, true, 'SocialTrust Ethereum Wallet'),
('0xC69088eB5F015Fca5B385b8E3A0463749813093e', 137, true, 'SocialTrust Polygon Wallet'),
('0xC69088eB5F015Fca5B385b8E3A0463749813093e', 56, true, 'SocialTrust BSC Wallet')
ON CONFLICT (wallet_address, network_id) DO NOTHING;

-- Function to clean up expired payment sessions
CREATE OR REPLACE FUNCTION cleanup_expired_payments()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Update expired sessions
  UPDATE crypto_payment_sessions 
  SET status = 'expired' 
  WHERE status = 'pending' 
    AND expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log the cleanup
  INSERT INTO crypto_transaction_logs (
    network_id, network_name, from_address, to_address, 
    amount, token_symbol, verification_status,
    raw_transaction
  ) VALUES (
    0, 'system', 'cleanup_job', 'expired_sessions',
    deleted_count, 'CLEANUP', 'confirmed',
    jsonb_build_object('expired_count', deleted_count, 'timestamp', now())
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get payment session with extended info
CREATE OR REPLACE FUNCTION get_payment_session_info(session_payment_id TEXT)
RETURNS TABLE (
  payment_id TEXT,
  plan_id TEXT,
  status TEXT,
  usd_amount DECIMAL,
  crypto_amount DECIMAL,
  crypto_symbol TEXT,
  network_name TEXT,
  receiver_wallet TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  time_remaining INTERVAL,
  tx_hash TEXT,
  confirmations INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cps.payment_id,
    cps.plan_id,
    cps.status,
    cps.usd_amount,
    cps.crypto_amount,
    cps.crypto_symbol,
    CASE cps.network_id
      WHEN 1 THEN 'Ethereum'
      WHEN 137 THEN 'Polygon'
      WHEN 56 THEN 'BSC'
      ELSE 'Unknown'
    END as network_name,
    cps.receiver_wallet,
    cps.expires_at,
    CASE 
      WHEN cps.expires_at > now() THEN cps.expires_at - now()
      ELSE INTERVAL '0'
    END as time_remaining,
    cps.tx_hash,
    cps.confirmations
  FROM crypto_payment_sessions cps
  WHERE cps.payment_id = session_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
SELECT 'Crypto payment database setup completed' as status;
SELECT 'crypto_payment_sessions' as table_name, COUNT(*) as row_count FROM crypto_payment_sessions;
SELECT 'wallet_monitoring' as table_name, COUNT(*) as row_count FROM wallet_monitoring;