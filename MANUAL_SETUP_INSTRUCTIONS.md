# 🚨 SETUP IMMEDIATO - ESEGUI QUESTI PASSAGGI

## ❗ PROBLEMA TROVATO
La tabella `user_profiles` NON ESISTE nel database Supabase. Per questo ricevi "undefined"!

## 🔧 SOLUZIONE IMMEDIATA

### STEP 1: SUPABASE SQL MIGRATION
1. **Vai su**: https://supabase.com/dashboard/project/zsionhetkwaslvounaqo/sql
2. **Copia e incolla questo codice completo:**

```sql
-- Create user_profiles table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_enterprise ON user_profiles(enterprise_access);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO anon, authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
```

3. **Clicca RUN**

### STEP 2: NETLIFY ENVIRONMENT VARIABLES
1. **Vai su**: https://app.netlify.com/sites/[TUO_SITO]/settings/env
2. **Aggiungi queste 2 variabili:**

```
VITE_SUPABASE_URL
https://zsionhetkwaslvounaqo.supabase.co

VITE_SUPABASE_ANON_KEY  
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaW9uaGV0a3dhc2x2b3VuYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTgwNTUsImV4cCI6MjA3MTYzNDA1NX0.5DVKWx1-r3lkuUo7UVVnorTSq_HTZz3Gr6J6jbDJ5ig
```

3. **Salva**

### STEP 3: REDEPLOY
1. **Netlify → Deploys → Trigger deploy**
2. **Aspetta completamento deploy**

## 🎯 RISULTATO
Dopo questi 3 step:
- ✅ Database configurato
- ✅ Environment variables settate  
- ✅ Deploy con configurazione corretta
- ✅ Registrazione funzionante!

## 🔐 TUA EMAIL ENTERPRISE
`robertoromagnino83@gmail.com` avrà automaticamente accesso enterprise a tutte le funzionalità.

**TEMPO STIMATO: 3 minuti** ⚡

**FAI QUESTI 3 STEP E IL SISTEMA SARÀ PERFETTO!** 🚀