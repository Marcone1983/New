-- Authentication System Database Schema
-- Run this in your Supabase SQL Editor

-- Create user_profiles table to store additional user data
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    company_name TEXT,
    subscription_plan TEXT DEFAULT 'free',
    enterprise_access BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_enterprise ON user_profiles(enterprise_access);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();

-- Create session_tokens table for managing custom sessions
CREATE TABLE IF NOT EXISTS session_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for session tokens
CREATE INDEX IF NOT EXISTS idx_session_tokens_user_id ON session_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_session_tokens_hash ON session_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_session_tokens_expires ON session_tokens(expires_at);

-- RLS for session_tokens
ALTER TABLE session_tokens ENABLE ROW LEVEL SECURITY;

-- Only allow users to access their own session tokens
CREATE POLICY IF NOT EXISTS "Users can manage own session tokens" ON session_tokens
    FOR ALL USING (auth.uid() = user_id);

-- Create function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_session_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM session_tokens WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Create user activity log table for audit purposes
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for activity log
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_log(created_at);

-- RLS for activity log
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own activity log
CREATE POLICY IF NOT EXISTS "Users can view own activity log" ON user_activity_log
    FOR SELECT USING (auth.uid() = user_id);

-- Insert enterprise user if not exists
DO $$
BEGIN
    -- This will create the profile when the user registers
    -- The actual user creation happens through Supabase Auth
    INSERT INTO user_profiles (
        user_id, 
        email, 
        full_name, 
        subscription_plan, 
        enterprise_access
    ) VALUES (
        '00000000-0000-0000-0000-000000000000', -- Placeholder UUID
        'robertoromagnino83@gmail.com',
        'Roberto Romagnino',
        'enterprise',
        true
    ) ON CONFLICT (email) DO UPDATE SET
        subscription_plan = 'enterprise',
        enterprise_access = true,
        updated_at = now();
EXCEPTION
    WHEN others THEN
        -- Ignore errors (user might not exist in auth.users yet)
        NULL;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_tokens TO anon, authenticated;
GRANT SELECT, INSERT ON user_activity_log TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Enable realtime if needed (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;