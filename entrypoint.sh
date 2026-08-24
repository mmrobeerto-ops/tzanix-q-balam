#!/bin/sh

# Obtener fecha actual en segundos Epoch
CURRENT_DATE=$(date +%s)

# Si BUILD_DATE no es numérico, usar la fecha actual como fallback
case "$BUILD_DATE" in
    ''|*[!0-9]*) BUILD_DATE=$CURRENT_DATE ;;
esac

# Calcular los segundos transcurridos desde que se construyó la imagen
ELAPSED=$((CURRENT_DATE - BUILD_DATE))

# 33 Días en Segundos = 33 * 24 * 60 * 60 = 2851200
TRIAL_PERIOD=2851200

echo "------------------------------------------------------"
echo "[TZANiX Q-GUARD] Validando licencia de prueba (33 Días)"
echo "------------------------------------------------------"

if [ "$ELAPSED" -gt "$TRIAL_PERIOD" ]; then
    echo "❌ ERROR FATAL: El periodo de prueba gratuito de 33 días ha EXPIRADO."
    echo "Comuníquese con mmrobeerto@gmail.com para adquirir TZANiX Enterprise."
    echo "Apagando el contenedor de seguridad..."
    exit 1
else
    REMAINING_SECS=$((TRIAL_PERIOD - ELAPSED))
    REMAINING_DAYS=$((REMAINING_SECS / 86400))
    echo "✅ LICENCIA VÁLIDA. Días restantes en la prueba: $REMAINING_DAYS"
    echo "Iniciando Radar Holográfico Cuántico..."
    # Iniciar Nginx
    exec nginx -g 'daemon off;'
fi
