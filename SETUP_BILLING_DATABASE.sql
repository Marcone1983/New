-- ENTERPRISE BILLING & SUBSCRIPTION DATABASE SCHEMA
-- Execute in Supabase SQL Editor after main database setup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations/Companies table (customers)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  domain TEXT,
  industry TEXT,
  company_size TEXT CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
  
  -- Billing information
  billing_email TEXT NOT NULL,
  billing_address JSONB,
  tax_id TEXT,
  
  -- Plan information
  current_plan_id TEXT NOT NULL DEFAULT 'free',
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'yearly', 'custom')) DEFAULT 'monthly',
  
  -- Subscription status
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')) DEFAULT 'active',
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  
  -- Stripe integration
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  
  -- Usage tracking
  current_period_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  current_period_end TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '1 month'),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_dates CHECK (subscription_end_date IS NULL OR subscription_end_date > subscription_start_date)
);

-- Organization members (team management)
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  role TEXT CHECK (role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL DEFAULT 'member',
  permissions JSONB DEFAULT '[]',
  
  -- Invitation management
  status TEXT CHECK (status IN ('active', 'invited', 'suspended')) DEFAULT 'invited',
  invited_by UUID REFERENCES users(id),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  joined_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(organization_id, user_id)
);

-- Subscription plans (mirrors the JavaScript config)
CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- Pricing
  monthly_price DECIMAL(10,2),
  yearly_price DECIMAL(10,2),
  currency TEXT DEFAULT 'EUR',
  
  -- Plan configuration
  features JSONB DEFAULT '[]',
  limits JSONB DEFAULT '{}',
  restrictions JSONB DEFAULT '{}',
  
  -- Stripe integration
  stripe_monthly_price_id TEXT,
  stripe_yearly_price_id TEXT,
  
  -- Plan status
  active BOOLEAN DEFAULT true,
  popular BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Usage tracking per organization
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Usage metrics
  metric_name TEXT NOT NULL, -- 'review_invites', 'api_requests', 'team_members', etc.
  current_usage INTEGER DEFAULT 0,
  limit_value INTEGER,
  
  -- Time period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(organization_id, metric_name, period_start)
);

-- Billing history and invoices
CREATE TABLE IF NOT EXISTS billing_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Invoice details
  invoice_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  status TEXT CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')) NOT NULL,
  
  -- Billing period
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  
  -- Payment details
  payment_method TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  due_date TIMESTAMP WITH TIME ZONE,
  
  -- Stripe integration
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  
  -- Invoice line items
  line_items JSONB DEFAULT '[]',
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Future monetization modules subscriptions
CREATE TABLE IF NOT EXISTS monetization_modules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  module_id TEXT NOT NULL, -- 'ai_sentiment_dashboard', 'tokenized_rewards', etc.
  module_name TEXT NOT NULL,
  
  -- Subscription details
  status TEXT CHECK (status IN ('active', 'inactive', 'trial', 'suspended')) DEFAULT 'active',
  pricing_type TEXT CHECK (pricing_type IN ('subscription', 'usage', 'credits', 'tiered')) NOT NULL,
  
  -- Pricing and usage
  base_price DECIMAL(10,2) DEFAULT 0,
  usage_price DECIMAL(10,4) DEFAULT 0,
  credits_available INTEGER DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  
  -- Subscription period
  subscription_start TIMESTAMP WITH TIME ZONE DEFAULT now(),
  subscription_end TIMESTAMP WITH TIME ZONE,
  
  -- Configuration
  module_config JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(organization_id, module_id)
);

-- Feature usage logs (for detailed analytics)
CREATE TABLE IF NOT EXISTS feature_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  feature_name TEXT NOT NULL,
  action TEXT NOT NULL, -- 'used', 'limited', 'blocked'
  
  -- Usage details
  usage_count INTEGER DEFAULT 1,
  request_data JSONB,
  response_data JSONB,
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  api_endpoint TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Partitioning ready
  CONSTRAINT feature_usage_logs_created_at_check CHECK (created_at >= '2025-01-01'::timestamp)
);

-- Plan change history
CREATE TABLE IF NOT EXISTS plan_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  from_plan_id TEXT,
  to_plan_id TEXT NOT NULL,
  change_type TEXT CHECK (change_type IN ('upgrade', 'downgrade', 'renewal', 'cancellation')) NOT NULL,
  
  -- Change details
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  prorated_amount DECIMAL(10,2),
  reason TEXT,
  
  -- Who made the change
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Webhooks and integrations
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL, -- 'subscription.created', 'invoice.paid', etc.
  source TEXT NOT NULL, -- 'stripe', 'internal', 'zapier'
  
  -- Event data
  event_data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processing_attempts INTEGER DEFAULT 0,
  
  -- Timing
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_current_plan ON organizations(current_plan_id);
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_period ON organizations(current_period_start, current_period_end);

CREATE INDEX IF NOT EXISTS idx_organization_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_status ON organization_members(status);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_org_metric ON usage_tracking(organization_id, metric_name);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_period ON usage_tracking(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_billing_history_org ON billing_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_status ON billing_history(status);
CREATE INDEX IF NOT EXISTS idx_billing_history_stripe ON billing_history(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_monetization_modules_org ON monetization_modules(organization_id);
CREATE INDEX IF NOT EXISTS idx_monetization_modules_module ON monetization_modules(module_id);
CREATE INDEX IF NOT EXISTS idx_monetization_modules_status ON monetization_modules(status);

CREATE INDEX IF NOT EXISTS idx_feature_usage_logs_org_feature ON feature_usage_logs(organization_id, feature_name);
CREATE INDEX IF NOT EXISTS idx_feature_usage_logs_created ON feature_usage_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);

-- Enable Row Level Security
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE monetization_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Organizations: Users can only see their own organization
CREATE POLICY "Users can view their organization" ON organizations
  FOR SELECT USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Organization owners can update" ON organizations
  FOR UPDATE USING (
    id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Organization members: Users can see members of their organization
CREATE POLICY "Members can view organization members" ON organization_members
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Usage tracking: Users can see their organization's usage
CREATE POLICY "Members can view organization usage" ON usage_tracking
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Billing history: Only owners and admins can see billing
CREATE POLICY "Admins can view billing history" ON billing_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND status = 'active'
    )
  );

-- Create automatic updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members;
CREATE TRIGGER update_organization_members_updated_at
    BEFORE UPDATE ON organization_members
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_usage_tracking_updated_at ON usage_tracking;
CREATE TRIGGER update_usage_tracking_updated_at
    BEFORE UPDATE ON usage_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_monetization_modules_updated_at ON monetization_modules;
CREATE TRIGGER update_monetization_modules_updated_at
    BEFORE UPDATE ON monetization_modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default subscription plans
INSERT INTO subscription_plans (
  id, name, display_name, description, monthly_price, yearly_price,
  features, limits, active, popular
) VALUES 
(
  'free', 'Free', 'Starter',
  'Perfect for getting started with online reputation management',
  0, 0,
  '["unlimited_reviews", "basic_profile", "respond_to_reviews", "basic_widgets"]',
  '{"reviewInvitesPerMonth": 50, "apiRequestsPerMonth": 1000, "teamMembers": 1}',
  true, false
),
(
  'plus', 'Plus', 'Growth',
  'Accelerate your reputation building with automation and insights',
  99, 990,
  '["unlimited_reviews", "basic_profile", "respond_to_reviews", "basic_widgets", "auto_review_invites", "custom_profile", "advanced_widgets", "basic_analytics"]',
  '{"reviewInvitesPerMonth": 200, "apiRequestsPerMonth": 5000, "teamMembers": 3}',
  true, true
),
(
  'premium', 'Premium', 'Professional', 
  'Advanced automation and analytics for professional reputation management',
  249, 2490,
  '["unlimited_reviews", "basic_profile", "respond_to_reviews", "basic_widgets", "auto_review_invites", "custom_profile", "advanced_widgets", "basic_analytics", "advanced_review_management", "marketing_automation", "detailed_reports"]',
  '{"reviewInvitesPerMonth": 1000, "apiRequestsPerMonth": 20000, "teamMembers": 10}',
  true, false
),
(
  'advanced', 'Advanced', 'Enterprise Ready',
  'Market intelligence and predictive analytics for competitive advantage', 
  499, 4990,
  '["unlimited_reviews", "basic_profile", "respond_to_reviews", "basic_widgets", "auto_review_invites", "custom_profile", "advanced_widgets", "basic_analytics", "advanced_review_management", "marketing_automation", "detailed_reports", "market_insights", "sentiment_analysis"]',
  '{"reviewInvitesPerMonth": 5000, "apiRequestsPerMonth": 50000, "teamMembers": 25}',
  true, false
),
(
  'enterprise', 'Enterprise', 'Custom Solution',
  'Fully customizable enterprise solution with AI and dedicated support',
  NULL, NULL,
  '["unlimited_reviews", "basic_profile", "respond_to_reviews", "basic_widgets", "auto_review_invites", "custom_profile", "advanced_widgets", "basic_analytics", "advanced_review_management", "marketing_automation", "detailed_reports", "market_insights", "sentiment_analysis", "ai_automated_responses", "full_api_access"]',
  '{"reviewInvitesPerMonth": null, "apiRequestsPerMonth": null, "teamMembers": null}',
  true, false
)
ON CONFLICT (id) DO NOTHING;

-- Create function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  org_id UUID,
  metric_name TEXT,
  increment_value INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  usage_limit INTEGER;
  org_plan TEXT;
  plan_limits JSONB;
BEGIN
  -- Get organization's current plan
  SELECT current_plan_id INTO org_plan
  FROM organizations 
  WHERE id = org_id;
  
  -- Get plan limits
  SELECT limits INTO plan_limits
  FROM subscription_plans
  WHERE id = org_plan;
  
  -- Extract specific limit
  usage_limit := (plan_limits->metric_name)::INTEGER;
  
  -- If no limit (enterprise plan), allow usage
  IF usage_limit IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Get current usage
  SELECT COALESCE(current_usage, 0) INTO current_usage
  FROM usage_tracking
  WHERE organization_id = org_id 
    AND metric_name = check_usage_limit.metric_name
    AND period_start <= now() 
    AND period_end > now();
  
  -- Check if adding increment would exceed limit
  RETURN (current_usage + increment_value) <= usage_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to increment usage
CREATE OR REPLACE FUNCTION increment_usage(
  org_id UUID,
  metric_name TEXT,
  increment_value INTEGER DEFAULT 1
) RETURNS BOOLEAN AS $$
DECLARE
  current_period_start TIMESTAMP WITH TIME ZONE;
  current_period_end TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Get organization's current billing period
  SELECT 
    organizations.current_period_start,
    organizations.current_period_end
  INTO current_period_start, current_period_end
  FROM organizations 
  WHERE id = org_id;
  
  -- Upsert usage tracking record
  INSERT INTO usage_tracking (
    organization_id, 
    metric_name, 
    current_usage, 
    period_start, 
    period_end
  ) VALUES (
    org_id,
    increment_usage.metric_name,
    increment_value,
    current_period_start,
    current_period_end
  )
  ON CONFLICT (organization_id, metric_name, period_start)
  DO UPDATE SET 
    current_usage = usage_tracking.current_usage + increment_value,
    updated_at = now();
    
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verification queries
SELECT 'Billing database setup completed' as status;
SELECT 'subscription_plans' as table_name, COUNT(*) as row_count FROM subscription_plans;
SELECT 'organizations' as table_name, COUNT(*) as row_count FROM organizations;