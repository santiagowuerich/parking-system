#!/usr/bin/env node

/**
 * Script de configuración de Google Maps
 * Ejecuta: node setup-google-maps.js TU_API_KEY_AQUI
 */

const fs = require('fs');
const path = require('path');

const apiKey = process.argv[2];

if (!apiKey) {
    console.log('❌ Uso: node setup-google-maps.js TU_API_KEY_AQUI');
    console.log('');
    console.log('📝 Pasos para obtener tu API key:');
    console.log('1. Ve a https://console.cloud.google.com/google/maps-apis');
    console.log('2. Crea un nuevo proyecto o selecciona uno existente');
    console.log('3. Habilita las APIs: Maps JavaScript API, Geocoding API, Places API');
    console.log('4. Crea una API key');
    console.log('5. Ejecuta este script con tu API key');
    process.exit(1);
}

const envPath = path.join(__dirname, '.env.local');
const envContent = `# Configuración de Google Maps
GOOGLE_MAPS_API_KEY=${apiKey}
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${apiKey}

# Tu configuración existente...
`;

try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Archivo .env.local creado exitosamente!');
    console.log('📍 Ubicación:', envPath);
    console.log('');
    console.log('🔄 Reinicia tu servidor de desarrollo:');
    console.log('npm run dev');
    console.log('');
    console.log('🗺️ Google Maps debería funcionar ahora!');
} catch (error) {
    console.error('❌ Error creando archivo .env.local:', error.message);
    console.log('');
    console.log('💡 Puedes crear el archivo manualmente con este contenido:');
    console.log(envContent);
}





