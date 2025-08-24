// Supabase Configuration with Environment Variables
const SUPABASE_URL = import.meta?.env?.VITE_SUPABASE_URL || 
                     process.env?.VITE_SUPABASE_URL || 
                     window?.ENV?.VITE_SUPABASE_URL ||
                     'https://zsionhetkwaslvounaqo.supabase.co'; // Fallback for static hosting

const SUPABASE_ANON_KEY = import.meta?.env?.VITE_SUPABASE_ANON_KEY || 
                          process.env?.VITE_SUPABASE_ANON_KEY || 
                          window?.ENV?.VITE_SUPABASE_ANON_KEY ||
                          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaW9uaGV0a3dhc2x2b3VuYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTgwNTUsImV4cCI6MjA3MTYzNDA1NX0.5DVKWx1-r3lkuUo7UVVnorTSq_HTZz3Gr6J6jbDJ5ig'; // Fallback

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Database schema setup SQL (run in Supabase SQL editor):
/*
-- Create users table
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create businesses table  
CREATE TABLE businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  profile_url TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(name, platform)
);

-- Create reviews table
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id),
  user_id UUID REFERENCES users(id),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  platform TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_platform ON reviews(platform);
CREATE INDEX idx_businesses_name ON businesses(name);
CREATE INDEX idx_businesses_platform ON businesses(platform);

-- Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;  
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policies for public read access
CREATE POLICY "Allow public read access to businesses" ON businesses
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated users to insert reviews" ON reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own reviews" ON reviews
  FOR UPDATE USING (auth.uid() = user_id);
*/