-- COPIA QUESTO CODICE E INCOLLALO NEL SQL EDITOR DI SUPABASE
-- Dashboard Supabase → SQL Editor → New Query → Incolla e RUN

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create businesses table  
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  profile_url TEXT,
  verified BOOLEAN DEFAULT false,
  follower_count INTEGER DEFAULT 0,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(name, platform)
);

-- Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
  comment TEXT,
  platform TEXT NOT NULL,
  helpful_votes INTEGER DEFAULT 0,
  reported BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create API cache table for OSINT results
CREATE TABLE IF NOT EXISTS api_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  platform TEXT NOT NULL,
  response_data JSONB NOT NULL,
  hit_count INTEGER DEFAULT 1,
  first_cached_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by_ip TEXT,
  is_stale BOOLEAN DEFAULT false
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_business_id ON reviews(business_id);
CREATE INDEX IF NOT EXISTS idx_reviews_platform ON reviews(platform);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_businesses_name ON businesses(name);
CREATE INDEX IF NOT EXISTS idx_businesses_platform ON businesses(platform);
CREATE INDEX IF NOT EXISTS idx_businesses_created_at ON businesses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_cache_query_hash ON api_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_api_cache_platform ON api_cache(platform);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires_at ON api_cache(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to businesses" ON businesses;
DROP POLICY IF EXISTS "Allow public read access to reviews" ON reviews;
DROP POLICY IF EXISTS "Allow public insert to businesses" ON businesses;
DROP POLICY IF EXISTS "Allow public insert to reviews" ON reviews;
DROP POLICY IF EXISTS "Allow public insert to users" ON users;
DROP POLICY IF EXISTS "Allow public read access to api_cache" ON api_cache;
DROP POLICY IF EXISTS "Allow public write to api_cache" ON api_cache;
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
DROP POLICY IF EXISTS "Allow public update to businesses" ON businesses;

-- Public policies for businesses (read and insert)
CREATE POLICY "Allow public read access to businesses" ON businesses
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to businesses" ON businesses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update to businesses" ON businesses
  FOR UPDATE USING (true);

-- Public policies for reviews (read and insert)
CREATE POLICY "Allow public read access to reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert to reviews" ON reviews
  FOR INSERT WITH CHECK (true);

-- Public policies for users
CREATE POLICY "Allow public insert to users" ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read access to users" ON users
  FOR SELECT USING (true);

-- Public policies for API cache
CREATE POLICY "Allow public read access to api_cache" ON api_cache
  FOR SELECT USING (true);

CREATE POLICY "Allow public write to api_cache" ON api_cache
  FOR ALL USING (true);

-- Create a function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_businesses_updated_at ON businesses;
CREATE TRIGGER update_businesses_updated_at
    BEFORE UPDATE ON businesses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON reviews
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample businesses for testing
INSERT INTO businesses (name, platform, profile_url, verified, follower_count, description, category) 
VALUES 
  ('GrowVerse', 'instagram', 'https://instagram.com/growverse', true, 15000, 'Digital marketing agency specializing in growth strategies', 'marketing'),
  ('GrowVerse', 'linkedin', 'https://www.linkedin.com/company/growverse', true, 8500, 'Professional digital marketing services', 'marketing'),
  ('TechFlow Solutions', 'linkedin', 'https://www.linkedin.com/company/techflow-solutions', true, 12000, 'Enterprise software solutions', 'technology'),
  ('Pizza Corner', 'facebook', 'https://facebook.com/pizzacorner', false, 2500, 'Authentic Italian pizza restaurant', 'restaurant'),
  ('FitLife Gym', 'instagram', 'https://instagram.com/fitlifegym', true, 8900, '24/7 fitness center with personal trainers', 'fitness')
ON CONFLICT (name, platform) DO NOTHING;

-- Verify the setup
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'businesses' as table_name, COUNT(*) as row_count FROM businesses
UNION ALL  
SELECT 'reviews' as table_name, COUNT(*) as row_count FROM reviews
UNION ALL
SELECT 'api_cache' as table_name, COUNT(*) as row_count FROM api_cache;

-- Show sample businesses
SELECT name, platform, verified, follower_count FROM businesses ORDER BY name, platform;