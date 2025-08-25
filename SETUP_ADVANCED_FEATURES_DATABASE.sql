-- ADVANCED FEATURES DATABASE SCHEMA
-- Execute in Supabase SQL Editor for AI and monetization features

-- Sentiment Analysis Results
CREATE TABLE IF NOT EXISTS sentiment_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  text_analyzed TEXT NOT NULL,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  
  positive_score INTEGER DEFAULT 0,
  negative_score INTEGER DEFAULT 0,
  neutral_score INTEGER DEFAULT 0,
  
  topics JSONB DEFAULT '[]',
  insights JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- AI Generated Responses
CREATE TABLE IF NOT EXISTS ai_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  original_review TEXT NOT NULL,
  review_rating INTEGER CHECK (review_rating >= 1 AND review_rating <= 5),
  generated_response TEXT NOT NULL,
  
  sentiment TEXT NOT NULL,
  intensity TEXT CHECK (intensity IN ('low', 'medium', 'high')) NOT NULL,
  
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- TrustScore Forecasting
CREATE TABLE IF NOT EXISTS trustscore_forecasts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  current_score DECIMAL(2,1) NOT NULL,
  predicted_score DECIMAL(2,1) NOT NULL,
  trend TEXT CHECK (trend IN ('improving', 'stable', 'declining')) NOT NULL,
  confidence DECIMAL(3,2) NOT NULL,
  
  timeframe_days INTEGER NOT NULL,
  recommendations JSONB DEFAULT '[]',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- User Gamification Profiles
CREATE TABLE IF NOT EXISTS user_gamification (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  total_points INTEGER DEFAULT 0,
  current_level INTEGER DEFAULT 1,
  reviews_count INTEGER DEFAULT 0,
  
  badges_earned JSONB DEFAULT '[]',
  tokens_balance INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(user_id)
);

-- Points Transactions Log
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  points_awarded INTEGER NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- NFT Collection for Users
CREATE TABLE IF NOT EXISTS user_nfts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  
  nft_tier TEXT NOT NULL,
  nft_name TEXT NOT NULL,
  description TEXT,
  rarity TEXT CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')) NOT NULL,
  
  token_reward INTEGER DEFAULT 0,
  blockchain_hash TEXT,
  
  minted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT CHECK (status IN ('minted', 'transferred', 'burned')) DEFAULT 'minted'
);

-- VR/AR Content Library
CREATE TABLE IF NOT EXISTS vr_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  content_type TEXT CHECK (content_type IN ('business_tour', 'product_demo', 'service_simulation')) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  
  location_data JSONB,
  images_360 JSONB DEFAULT '[]',
  audio_description TEXT,
  
  duration_seconds INTEGER,
  view_count INTEGER DEFAULT 0,
  
  status TEXT CHECK (status IN ('processing', 'ready', 'failed')) DEFAULT 'processing',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Micro-Tips System
CREATE TABLE IF NOT EXISTS micro_tips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  
  tipper_wallet TEXT NOT NULL,
  receiver_wallet TEXT NOT NULL,
  
  amount_usd DECIMAL(10,2) NOT NULL,
  amount_crypto DECIMAL(18,8) NOT NULL,
  currency TEXT NOT NULL,
  network TEXT NOT NULL,
  
  tx_hash TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Insights Marketplace
CREATE TABLE IF NOT EXISTS marketplace_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  
  price_usd DECIMAL(10,2) NOT NULL,
  data_preview JSONB,
  full_data JSONB,
  
  downloads_count INTEGER DEFAULT 0,
  rating DECIMAL(2,1),
  
  status TEXT CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Widget Marketplace
CREATE TABLE IF NOT EXISTS widget_marketplace (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  developer_email TEXT NOT NULL,
  
  widget_code TEXT NOT NULL,
  preview_image TEXT,
  
  price_usd DECIMAL(10,2) DEFAULT 0,
  category TEXT NOT NULL,
  
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1),
  
  status TEXT CHECK (status IN ('pending_review', 'approved', 'rejected')) DEFAULT 'pending_review',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ethics & Sustainability Audits
CREATE TABLE IF NOT EXISTS ethics_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  audit_type TEXT NOT NULL,
  documentation_provided JSONB DEFAULT '[]',
  requested_badges JSONB DEFAULT '[]',
  
  auditor_assigned TEXT,
  audit_report JSONB,
  
  badges_awarded JSONB DEFAULT '[]',
  audit_fee_usd DECIMAL(10,2) NOT NULL,
  
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Feature Unlocks (temporary unlocks for specific features)
CREATE TABLE IF NOT EXISTS feature_unlocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  feature_id TEXT NOT NULL,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  status TEXT CHECK (status IN ('active', 'expired', 'revoked')) DEFAULT 'active'
);

-- Churn Prediction Results
CREATE TABLE IF NOT EXISTS churn_predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  customer_email TEXT NOT NULL,
  risk_score INTEGER NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')) NOT NULL,
  
  risk_factors JSONB DEFAULT '[]',
  recommendations JSONB DEFAULT '[]',
  
  last_review_date TIMESTAMP WITH TIME ZONE,
  last_rating INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_org ON sentiment_analyses(organization_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_sentiment ON sentiment_analyses(sentiment);
CREATE INDEX IF NOT EXISTS idx_sentiment_analyses_created ON sentiment_analyses(created_at);

CREATE INDEX IF NOT EXISTS idx_ai_responses_org ON ai_responses(organization_id);
CREATE INDEX IF NOT EXISTS idx_ai_responses_used ON ai_responses(used);

CREATE INDEX IF NOT EXISTS idx_trustscore_forecasts_org ON trustscore_forecasts(organization_id);
CREATE INDEX IF NOT EXISTS idx_trustscore_forecasts_created ON trustscore_forecasts(created_at);

CREATE INDEX IF NOT EXISTS idx_user_gamification_user ON user_gamification(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gamification_level ON user_gamification(current_level);
CREATE INDEX IF NOT EXISTS idx_user_gamification_points ON user_gamification(total_points);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created ON points_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_user_nfts_user ON user_nfts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_nfts_tier ON user_nfts(nft_tier);
CREATE INDEX IF NOT EXISTS idx_user_nfts_rarity ON user_nfts(rarity);

CREATE INDEX IF NOT EXISTS idx_vr_content_org ON vr_content(organization_id);
CREATE INDEX IF NOT EXISTS idx_vr_content_type ON vr_content(content_type);
CREATE INDEX IF NOT EXISTS idx_vr_content_status ON vr_content(status);

CREATE INDEX IF NOT EXISTS idx_micro_tips_review ON micro_tips(review_id);
CREATE INDEX IF NOT EXISTS idx_micro_tips_status ON micro_tips(status);
CREATE INDEX IF NOT EXISTS idx_micro_tips_created ON micro_tips(created_at);

CREATE INDEX IF NOT EXISTS idx_marketplace_insights_category ON marketplace_insights(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_insights_status ON marketplace_insights(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_insights_price ON marketplace_insights(price_usd);

CREATE INDEX IF NOT EXISTS idx_widget_marketplace_category ON widget_marketplace(category);
CREATE INDEX IF NOT EXISTS idx_widget_marketplace_status ON widget_marketplace(status);
CREATE INDEX IF NOT EXISTS idx_widget_marketplace_rating ON widget_marketplace(rating);

CREATE INDEX IF NOT EXISTS idx_ethics_audits_org ON ethics_audits(organization_id);
CREATE INDEX IF NOT EXISTS idx_ethics_audits_status ON ethics_audits(status);

CREATE INDEX IF NOT EXISTS idx_feature_unlocks_org_feature ON feature_unlocks(organization_id, feature_id);
CREATE INDEX IF NOT EXISTS idx_feature_unlocks_expires ON feature_unlocks(expires_at);

CREATE INDEX IF NOT EXISTS idx_churn_predictions_org ON churn_predictions(organization_id);
CREATE INDEX IF NOT EXISTS idx_churn_predictions_risk ON churn_predictions(risk_level);

-- Enable Row Level Security
ALTER TABLE sentiment_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE trustscore_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_nfts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vr_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE micro_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE widget_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethics_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see their own gamification data
CREATE POLICY "Users can view their gamification profile" ON user_gamification
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their gamification profile" ON user_gamification
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can see their own NFTs
CREATE POLICY "Users can view their NFTs" ON user_nfts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can see their own points transactions
CREATE POLICY "Users can view their points transactions" ON points_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Organization members can see sentiment analyses for their org
CREATE POLICY "Members can view org sentiment analyses" ON sentiment_analyses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Similar policies for other org-specific tables
CREATE POLICY "Members can view org AI responses" ON ai_responses
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can view org forecasts" ON trustscore_forecasts
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- Public marketplace tables (browsable by all)
CREATE POLICY "Public can browse insights marketplace" ON marketplace_insights
  FOR SELECT USING (status = 'active');

CREATE POLICY "Public can browse widget marketplace" ON widget_marketplace
  FOR SELECT USING (status = 'approved');

-- Create updated_at triggers
DROP TRIGGER IF EXISTS update_user_gamification_updated_at ON user_gamification;
CREATE TRIGGER update_user_gamification_updated_at
    BEFORE UPDATE ON user_gamification
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vr_content_updated_at ON vr_content;
CREATE TRIGGER update_vr_content_updated_at
    BEFORE UPDATE ON vr_content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Utility functions for gamification
CREATE OR REPLACE FUNCTION award_points(
  p_user_id UUID,
  p_points INTEGER,
  p_action TEXT DEFAULT 'manual'
) RETURNS JSONB AS $$
DECLARE
  current_profile RECORD;
  new_level INTEGER;
  level_up BOOLEAN := FALSE;
  result JSONB;
BEGIN
  -- Get current profile
  SELECT * INTO current_profile
  FROM user_gamification 
  WHERE user_id = p_user_id;
  
  -- Create profile if doesn't exist
  IF current_profile IS NULL THEN
    INSERT INTO user_gamification (user_id, total_points, current_level)
    VALUES (p_user_id, p_points, 1)
    RETURNING * INTO current_profile;
    
    new_level := 1;
  ELSE
    -- Update points
    UPDATE user_gamification 
    SET total_points = total_points + p_points,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO current_profile;
    
    -- Check for level up
    new_level := CASE 
      WHEN current_profile.total_points >= 15000 THEN 6
      WHEN current_profile.total_points >= 5000 THEN 5
      WHEN current_profile.total_points >= 2000 THEN 4
      WHEN current_profile.total_points >= 500 THEN 3
      WHEN current_profile.total_points >= 100 THEN 2
      ELSE 1
    END;
    
    IF new_level > current_profile.current_level THEN
      level_up := TRUE;
      UPDATE user_gamification 
      SET current_level = new_level
      WHERE user_id = p_user_id;
    END IF;
  END IF;
  
  -- Log the transaction
  INSERT INTO points_transactions (user_id, points_awarded, action)
  VALUES (p_user_id, p_points, p_action);
  
  -- Return result
  result := jsonb_build_object(
    'success', TRUE,
    'points_awarded', p_points,
    'new_total', current_profile.total_points,
    'level_up', level_up,
    'new_level', new_level
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check NFT eligibility
CREATE OR REPLACE FUNCTION check_nft_eligibility(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  review_count INTEGER;
  owned_nfts TEXT[];
  result JSONB;
BEGIN
  -- Count user's reviews
  SELECT COUNT(*) INTO review_count
  FROM reviews 
  WHERE user_id = p_user_id;
  
  -- Get owned NFT tiers
  SELECT ARRAY_AGG(nft_tier) INTO owned_nfts
  FROM user_nfts 
  WHERE user_id = p_user_id;
  
  owned_nfts := COALESCE(owned_nfts, ARRAY[]::TEXT[]);
  
  -- Build result
  result := jsonb_build_object(
    'review_count', review_count,
    'owned_nfts', to_jsonb(owned_nfts),
    'eligible_for', jsonb_build_array()
  );
  
  -- Check eligibility for each tier
  IF review_count >= 1 AND NOT 'bronze' = ANY(owned_nfts) THEN
    result := jsonb_set(result, '{eligible_for}', 
      result->'eligible_for' || '"bronze"'::jsonb);
  END IF;
  
  IF review_count >= 5 AND NOT 'silver' = ANY(owned_nfts) THEN
    result := jsonb_set(result, '{eligible_for}', 
      result->'eligible_for' || '"silver"'::jsonb);
  END IF;
  
  IF review_count >= 25 AND NOT 'gold' = ANY(owned_nfts) THEN
    result := jsonb_set(result, '{eligible_for}', 
      result->'eligible_for' || '"gold"'::jsonb);
  END IF;
  
  IF review_count >= 100 AND NOT 'platinum' = ANY(owned_nfts) THEN
    result := jsonb_set(result, '{eligible_for}', 
      result->'eligible_for' || '"platinum"'::jsonb);
  END IF;
  
  IF review_count >= 500 AND NOT 'diamond' = ANY(owned_nfts) THEN
    result := jsonb_set(result, '{eligible_for}', 
      result->'eligible_for' || '"diamond"'::jsonb);
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert sample gamification levels for reference
INSERT INTO subscription_plans (
  id, name, display_name, description, monthly_price, yearly_price, active
) VALUES 
('gamification_premium', 'Gamification Premium', 'Enhanced Gamification', 
 'Unlock advanced gamification features', 99, 990, true)
ON CONFLICT (id) DO NOTHING;

-- Verification queries
SELECT 'Advanced features database setup completed' as status;
SELECT 'sentiment_analyses' as table_name, COUNT(*) as row_count FROM sentiment_analyses;
SELECT 'user_gamification' as table_name, COUNT(*) as row_count FROM user_gamification;
SELECT 'user_nfts' as table_name, COUNT(*) as row_count FROM user_nfts;