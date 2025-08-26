#!/bin/bash

echo "🔍 VERIFICO STATO SETUP SOCIALTRUST..."
echo "=================================="

# Check Supabase table
echo "1. 📊 Controllo tabella user_profiles..."
SUPABASE_CHECK=$(curl -s -X GET 'https://zsionhetkwaslvounaqo.supabase.co/rest/v1/user_profiles?limit=1' \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaW9uaGV0a3dhc2x2b3VuYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTgwNTUsImV4cCI6MjA3MTYzNDA1NX0.5DVKWx1-r3lkuUo7UVVnorTSq_HTZz3Gr6J6jbDJ5ig" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaW9uaGV0a3dhc2x2b3VuYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTgwNTUsImV4cCI6MjA3MTYzNDA1NX0.5DVKWx1-r3lkuUo7UVVnorTSq_HTZz3Gr6J6jbDJ5ig")

if echo "$SUPABASE_CHECK" | grep -q "PGRST205"; then
    echo "   ❌ Tabella user_profiles NON ESISTE"
    echo "   🔧 AZIONE: Esegui migrazione SQL in Supabase"
else
    echo "   ✅ Tabella user_profiles ESISTE"
fi

echo ""
echo "2. 🌐 Controllo connessione Supabase..."
SUPABASE_PING=$(curl -s -X GET 'https://zsionhetkwaslvounaqo.supabase.co/rest/v1/' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzaW9uaGV0a3dhc2x2b3VuYXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTgwNTUsImV4cCI6MjA3MTYzNDA1NX0.5DVKWx1-r3lkuUo7UVVnorTSq_HTZz3Gr6J6jbDJ5ig")

if [ $? -eq 0 ]; then
    echo "   ✅ Supabase RAGGIUNGIBILE"
else
    echo "   ❌ Supabase NON RAGGIUNGIBILE"
fi

echo ""
echo "3. 📋 STATO FINALE:"
if echo "$SUPABASE_CHECK" | grep -q "PGRST205"; then
    echo "   ❌ SETUP INCOMPLETO - Esegui migrazione database"
    echo "   📖 Leggi: MANUAL_SETUP_INSTRUCTIONS.md"
else
    echo "   ✅ SETUP COMPLETO - Sistema pronto!"
    echo "   🚀 Prova la registrazione su /register.html"
fi

echo ""
echo "=================================="