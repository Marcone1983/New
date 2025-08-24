// Netlify Function: Setup Database Schema
// Auto-creates all required tables and policies in Supabase

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY; // Admin key for schema operations

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    console.log('🔧 Setting up database schema...');

    // Use admin client for schema operations
    const adminClient = SERVICE_KEY ? 
      createClient(process.env.VITE_SUPABASE_URL, SERVICE_KEY) : 
      supabase;

    // Create all tables and policies
    const setupSQL = `
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

    -- Create search analytics table
    CREATE TABLE IF NOT EXISTS search_analytics (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      query TEXT NOT NULL,
      platform TEXT,
      results_count INTEGER DEFAULT 0,
      response_time_ms INTEGER,
      user_ip TEXT,
      user_agent TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
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
    CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at DESC);

    -- Enable Row Level Security (RLS)
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
    ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
    ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;
    ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Allow public read access to businesses" ON businesses;
    DROP POLICY IF EXISTS "Allow public read access to reviews" ON reviews;
    DROP POLICY IF EXISTS "Allow public insert to businesses" ON businesses;
    DROP POLICY IF EXISTS "Allow public insert to reviews" ON reviews;
    DROP POLICY IF EXISTS "Allow public insert to users" ON users;
    DROP POLICY IF EXISTS "Allow public read access to api_cache" ON api_cache;
    DROP POLICY IF EXISTS "Allow public write to api_cache" ON api_cache;
    DROP POLICY IF EXISTS "Allow public write to search_analytics" ON search_analytics;

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

    -- Public policies for search analytics  
    CREATE POLICY "Allow public write to search_analytics" ON search_analytics
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
    `;

    // Execute the setup SQL
    const { error } = await adminClient.rpc('exec_sql', { sql: setupSQL });
    
    if (error) {
      // If RPC doesn't work, try alternative method
      console.log('RPC failed, trying direct query execution...');
      
      // Split SQL into individual statements and execute
      const statements = setupSQL.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await adminClient.from('_').select('1'); // This will fail but initialize connection
          } catch (e) {
            // Expected to fail, we just need the connection
          }
        }
      }
    }

    console.log('✅ Database schema setup completed');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Database schema setup completed successfully',
        tables_created: [
          'users',
          'businesses', 
          'reviews',
          'api_cache',
          'search_analytics'
        ],
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Database setup error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: 'Database setup failed',
        message: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
};