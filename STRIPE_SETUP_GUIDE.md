# 🏦 GUIDA COMPLETA STRIPE SETUP - DA ZERO A HERO

## STEP 1: Registrazione Account Stripe

1. **Vai su https://stripe.com**
2. **Clicca "Start now" → "Create account"**
3. **Inserisci:**
   - Email aziendale
   - Nome completo
   - Password sicura
4. **Verifica email** (check inbox)

---

## STEP 2: Configurazione Business Profile

1. **Dashboard Stripe → Settings → Business settings**
2. **Compila tutto:**
   ```
   Business name: SocialTrust srl
   Business type: Software company
   Country: Italy
   Industry: Software as a Service
   Website: https://frabjous-peony-c1cb3a.netlify.app
   Support email: support@socialtrust.com
   ```

3. **Business address** (necessario per pagamenti):
   - Via, civico, città, CAP, Italia

---

## STEP 3: Ottenere le API Keys

### 📋 **IMPORTANTE: Inizia sempre in TEST MODE**

1. **Dashboard Stripe → Developers → API keys**
2. **Assicurati che sia su "View test data" (toggle in alto)**
3. **Copia queste 2 chiavi:**

```bash
# TEST KEYS (per sviluppo)
STRIPE_PUBLISHABLE_KEY = pk_test_51xxxxx...
STRIPE_SECRET_KEY = sk_test_51xxxxx...
```

⚠️ **NON condividere mai la Secret Key!**

---

## STEP 4: Creare i Prodotti e Prezzi

### **Metodo 1: Via Dashboard (Facile)**

1. **Products → Add product**
2. **Crea ogni piano:**

```
PIANO PLUS:
- Nome: "SocialTrust Plus"  
- Description: "Growth plan for businesses"
- Pricing model: "Recurring"
- Price: €99/month, €990/year
- Salva → Copia il Price ID (price_xxxxx)

PIANO PREMIUM:
- Nome: "SocialTrust Premium"
- Description: "Professional reputation management" 
- Price: €249/month, €2490/year

PIANO ADVANCED:  
- Nome: "SocialTrust Advanced"
- Description: "Enterprise-ready solution"
- Price: €499/month, €4990/year
```

### **Metodo 2: Via API (Automatico)**
Ti creo uno script che fa tutto automaticamente.

---

## STEP 5: Configurare Webhooks

1. **Developers → Webhooks → Add endpoint**
2. **Endpoint URL:** 
   ```
   https://frabjous-peony-c1cb3a.netlify.app/.netlify/functions/stripe-webhooks
   ```

3. **Eventi da ascoltare:**
   ```
   customer.subscription.created
   customer.subscription.updated  
   customer.subscription.deleted
   invoice.payment_succeeded
   invoice.payment_failed
   ```

4. **Copia il Webhook Signing Secret:** `whsec_xxxxx`

---

## STEP 6: Environment Variables

Dopo aver ottenuto le chiavi, aggiungi in **Netlify → Environment Variables:**

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_51xxxxx...
STRIPE_PUBLISHABLE_KEY=pk_test_51xxxxx...
STRIPE_WEBHOOK_SECRET=whsec_xxxxx...

# Plan Price IDs (da Step 4)
STRIPE_PLUS_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PLUS_YEARLY_PRICE_ID=price_xxxxx  
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_PREMIUM_YEARLY_PRICE_ID=price_xxxxx
STRIPE_ADVANCED_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_ADVANCED_YEARLY_PRICE_ID=price_xxxxx
```

---

## STEP 7: Test con Carte di Credito Fake

Stripe fornisce carte di test:

```bash
# Carta che funziona sempre
4242 4242 4242 4242

# Carta che viene rifiutata  
4000 0000 0000 0002

# Carta che richiede 3D Secure
4000 0025 0000 3155

# Qualsiasi CVV: 123
# Qualsiasi data futura: 12/34
```

---

## 🚨 INFORMAZIONI CHE MI SERVONO DA TE:

Dopo aver fatto questi step, mandami:

1. ✅ **Le 2 API Keys** (pk_test_... e sk_test_...)
2. ✅ **Webhook Secret** (whsec_...)  
3. ✅ **I 6 Price IDs** (price_...) dei piani
4. ✅ **Email business** per Stripe
5. ✅ **Nome business** ufficiale

---

## 🎯 COSA IMPLEMENTO IO:

Con questi dati creo automaticamente:

### **Backend Payment System:**
- `/stripe-create-subscription` - Crea abbonamenti
- `/stripe-cancel-subscription` - Cancella abbonamenti  
- `/stripe-update-subscription` - Upgrade/downgrade
- `/stripe-webhooks` - Handler eventi Stripe
- `/stripe-customer-portal` - Gestione account cliente

### **Frontend Payment UI:**
- Modulo selezione piano
- Stripe Checkout integration
- Customer portal link
- Subscription status dashboard

### **Business Logic:**
- Usage tracking automatico
- Limiti piano enforced runtime
- Email notifications
- Invoice management

---

## ⏱️ TIMELINE:

- **Setup Stripe account:** 15 minuti
- **Configurazione prodotti:** 10 minuti  
- **Webhook setup:** 5 minuti
- **Implementazione codice:** 2-3 ore (fatta da me)

**TOTALE: Pagamenti reali funzionanti in mezza giornata! 🚀**

---

## 💡 PRO TIPS:

1. **Inizia sempre in TEST mode** - non riceverai addebiti reali
2. **Testa tutti i flussi** prima di andare live
3. **Stripe ha documentazione ottima** se ti serve aiuto
4. **Customer Portal** gestisce cancellazioni/upgrade automaticamente
5. **Webhooks sono critici** - senza di essi il sistema non funziona

**Pronto? Facciamo il setup! 🔥**