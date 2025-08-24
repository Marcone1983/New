# 🚀 Setup Supabase per SocialTrust

## 1. Crea Account Supabase

1. Vai su [supabase.com](https://supabase.com)
2. Clicca "Start your project" 
3. Registrati con GitHub/Google
4. Crea nuovo progetto chiamato "socialtrust"

## 2. Configura Database

Nel dashboard Supabase, vai su **SQL Editor** e esegui questo script:

```sql
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

-- Create indexes for better performance
CREATE INDEX idx_reviews_business_id ON reviews(business_id);
CREATE INDEX idx_reviews_platform ON reviews(platform);
CREATE INDEX idx_businesses_name ON businesses(name);
CREATE INDEX idx_businesses_platform ON businesses(platform);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;  
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Policies for public read access
CREATE POLICY "Allow public read access to businesses" ON businesses
  FOR SELECT USING (true);

CREATE POLICY "Allow public read access to reviews" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "Allow anyone to insert reviews" ON reviews
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert to businesses" ON businesses
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public insert to users" ON users
  FOR INSERT WITH CHECK (true);
```

## 3. Ottieni le Credenziali

1. Vai su **Settings** → **API**
2. Copia:
   - **Project URL** (es: `https://xxxxx.supabase.co`)
   - **anon/public key** (inizia con `eyJhbGc...`)

## 4. Configura Environment Variables

### Sviluppo Locale
Crea file `.env` nella root:
```bash
VITE_SUPABASE_URL=https://ojvlmqztvjnkvtmadcok.supabase.co
VITE_SUPABASE_ANON_KEY=tua_chiave_qui
```

### Netlify Production
Le variabili sono già configurate in `netlify.toml` - nessun setup aggiuntivo richiesto!

## 5. Deploy su Netlify

1. Committa le modifiche:
```bash
git add .
git commit -m "Add Supabase integration"
git push origin main
```

2. Netlify rileverà automaticamente i cambiamenti e ridistribuirà il sito.

## 6. Test

Apri l'app su Netlify e:
- ✅ Aggiungi una recensione  
- ✅ Cerca un business
- ✅ Verifica che le statistiche si aggiornino
- ✅ Controlla che i dati persistano tra sessioni

## 🎯 Funzionalità Implementate

### ✅ Database Centrale
- Tutte le recensioni condivise globalmente
- Statistiche real-time di tutti gli utenti

### ✅ Ricerca Business Intelligente  
- Autocomplete con suggerimenti
- Ricerca cross-platform
- Discovery automatico profili social

### ✅ Performance
- Caching intelligente delle query
- Debounced search (500ms)
- Fallback a localStorage se Supabase offline

## 🔧 Troubleshooting

**Errore 403:** Controlla che le policies RLS permettano operazioni pubbliche

**App non carica:** Verifica URL e API key in `supabase-config.js`

**Recensioni non appaiono:** Controlla console browser per errori API

## 📈 Next Steps

- [ ] Autenticazione utenti con email
- [ ] Moderazione recensioni  
- [ ] Upload immagini business
- [ ] Integrazione API social per profile verification
- [ ] Push notifications per nuove recensioni

L'app è ora **enterprise-ready** con database scalabile! 🚀