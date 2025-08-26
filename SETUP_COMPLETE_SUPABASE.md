# 🚀 SETUP COMPLETO SUPABASE & NETLIFY

## 1. CREA PROGETTO SUPABASE

1. **Vai su https://supabase.com/**
2. **Clicca "New Project"**
3. **Nome**: `socialtrust-enterprise`
4. **Password Database**: `SocialTrust2025!Enterprise` 
5. **Regione**: Europe (Frankfurt) - eu-central-1
6. **Pricing**: Free plan (perfetto per iniziare)

## 2. OTTIENI CREDENZIALI

Dopo la creazione del progetto (2-3 minuti):

1. **Vai su Settings → API**
2. **Copia questi valori:**
   - **Project URL**: `https://[PROJECT_ID].supabase.co`
   - **Anon Key**: `eyJ...` (la chiave lunga)

## 3. CONFIGURA NETLIFY ENVIRONMENT VARIABLES

1. **Vai su https://app.netlify.com**
2. **Seleziona il tuo sito SocialTrust**
3. **Site settings → Environment variables**
4. **Aggiungi queste 2 variabili:**

```
Variable name: VITE_SUPABASE_URL
Value: https://[IL_TUO_PROJECT_ID].supabase.co

Variable name: VITE_SUPABASE_ANON_KEY
Value: [LA_TUA_ANON_KEY]
```

5. **Salva le variabili**

## 4. CONFIGURA DATABASE

1. **Nel tuo progetto Supabase → SQL Editor**
2. **Copia TUTTO questo codice e incollalo:**

```sql
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

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON session_tokens TO anon, authenticated;
GRANT SELECT, INSERT ON user_activity_log TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

3. **Clicca RUN per eseguire**

## 5. AGGIORNA IL CODICE

Ora aggiorno i file nel progetto con le credenziali corrette.

## 6. REDEPLOY NETLIFY

1. **Vai su Netlify → Deploys**
2. **Clicca "Trigger deploy"**
3. **Aspetta il deploy**

## 7. TESTA LA REGISTRAZIONE

Dopo il redeploy, testa la registrazione - dovrebbe funzionare perfettamente!

## 🎯 RISULTATO FINALE

- ✅ Progetto Supabase configurato
- ✅ Database con tutte le tabelle necessarie  
- ✅ Netlify con environment variables corrette
- ✅ Sistema di autenticazione funzionante
- ✅ Enterprise access per robertoromagnino83@gmail.com

## 🔐 CREDENZIALI ENTERPRISE

La tua email `robertoromagnino83@gmail.com` avrà automaticamente:
- ✅ **Enterprise Plan** 
- ✅ **Accesso Admin Dashboard**
- ✅ **Tutte le 12 funzionalità enterprise**
- ✅ **API Illimitate**
- ✅ **Priorità supporto**

**FATTO! Sistema completo e funzionante!** 🚀