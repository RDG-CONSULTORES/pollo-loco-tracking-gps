#!/bin/bash

# ============================================
# Script para aplicar fix de schema en Railway
# ============================================

echo "🔧 Aplicando fix definitivo de schema..."

# Verificar que tenemos la URL de la base de datos
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no encontrado"
  exit 1
fi

echo "✅ DATABASE_URL encontrado"

# Aplicar el script SQL
echo "📄 Ejecutando fix-schema-production.sql..."

psql "$DATABASE_URL" -f fix-schema-production.sql

if [ $? -eq 0 ]; then
  echo "✅ Schema actualizado exitosamente!"
  echo "🎯 El sistema ahora usa estándares en inglés"
else
  echo "❌ Error aplicando schema fix"
  exit 1
fi

echo "🚀 Fix completado. Reiniciando aplicación..."