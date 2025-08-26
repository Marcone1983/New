#!/bin/bash

# 🚀 QUICK SETUP SCRIPT - SocialTrust Enterprise

echo "🚀 SocialTrust Enterprise - Setup Automatico"
echo "============================================"
echo ""

echo "✅ STEP 1: Progetti"
echo "1. Supabase: https://supabase.com → New Project"
echo "   - Nome: socialtrust-enterprise"
echo "   - Password: SocialTrust2025!Enterprise"
echo "   - Regione: Europe (Frankfurt)"
echo ""

echo "✅ STEP 2: Credenziali (dopo creazione progetto)"
echo "Vai su Settings → API e copia:"
echo "- Project URL: https://[PROJECT_ID].supabase.co"
echo "- Anon Key: eyJ... (chiave lunga)"
echo ""

echo "✅ STEP 3: Netlify Environment Variables"
echo "https://app.netlify.com → Tuo sito → Site settings → Environment variables"
echo ""
echo "Aggiungi queste 2 variabili:"
echo "VITE_SUPABASE_URL=https://[PROJECT_ID].supabase.co"
echo "VITE_SUPABASE_ANON_KEY=[ANON_KEY]"
echo ""

echo "✅ STEP 4: Database (Supabase SQL Editor)"
echo "Copia il contenuto di database-migrations/003_auth_system.sql"
echo "Incolla in SQL Editor e clicca RUN"
echo ""

echo "✅ STEP 5: Redeploy"
echo "Netlify → Deploys → Trigger deploy"
echo ""

echo "🎯 FATTO! Sistema pronto per l'uso!"
echo ""
echo "La tua email robertoromagnino83@gmail.com avrà accesso enterprise automatico."
echo ""

# Display current project status
echo "📊 STATUS ATTUALE:"
echo "- ❌ Supabase: Non configurato"
echo "- ❌ Netlify Env: Non configurato"  
echo "- ❌ Database: Non migrato"
echo "- ❌ Deploy: Richiede redeploy"
echo ""
echo "Dopo il setup tutto sarà ✅ Verde!"