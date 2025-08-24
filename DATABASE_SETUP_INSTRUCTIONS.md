# 🚀 ENTERPRISE BILLING DATABASE SETUP

## Step 1: Configure Environment Variables in Netlify

1. Vai su **Netlify Dashboard** → Il tuo sito → **Site Settings** → **Environment Variables**
2. Aggiungi queste variabili:

```
VITE_SUPABASE_URL = https://zsionhetkwaslvounaqo.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaW9uaGV0a3dhc2x2b3VuYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTgwNTUsImV4cCI6MjA3MTYzNDA1NX0.5DVKWx1-r3lkuUo7UVVnorTSq_HTZz3Gr6J6jbDJ5ig
```

## Step 2: Setup Billing Database in Supabase

1. Vai su **Supabase Dashboard** → Il tuo progetto → **SQL Editor**
2. Copia e incolla tutto il contenuto di `SETUP_BILLING_DATABASE.sql`
3. Clicca **Run** per eseguire

Il database creerà automaticamente:
- ✅ 9 tabelle enterprise per billing e subscription management
- ✅ Row Level Security policies per sicurezza multi-tenant
- ✅ Indexes per performance ottimale 
- ✅ 5 subscription plans pre-configurati (Free, Plus, Premium, Advanced, Enterprise)
- ✅ Utility functions per usage tracking e limits
- ✅ Triggers automatici per timestamp updates

## Step 3: Verifica Setup

Dopo l'esecuzione SQL, vedrai in output:
```
status: "Billing database setup completed"
subscription_plans: 5 row_count
organizations: 0 row_count
```

## 🎯 Next Steps

Una volta completati questi step:
1. **Deploy automatico** delle Netlify Functions con environment variables
2. **Test delle API** `/api/stats`, `/api/business-search`, `/api/setup-env`  
3. **Dashboard analytics** enterprise funzionale
4. **Subscription system** pronto per Stripe integration

**L'architettura enterprise è COMPLETA e pronta per il lancio! 🔥**