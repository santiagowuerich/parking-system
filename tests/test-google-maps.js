#!/usr/bin/env node

/**
 * Script de verificación de Google Maps
 * Ejecuta: node test-google-maps.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Verificando configuración de Google Maps...\n');

// Verificar si existe .env.local
const envPath = path.join(__dirname, '.env.local');
const envExists = fs.existsSync(envPath);

if (!envExists) {
    console.log('❌ No se encontró el archivo .env.local');
    console.log('💡 Ejecuta: node setup-google-maps.js TU_API_KEY_REAL');
    process.exit(1);
}

console.log('✅ Archivo .env.local encontrado');

// Leer contenido del archivo
let envContent;
try {
    envContent = fs.readFileSync(envPath, 'utf8');
} catch (error) {
    console.log('❌ Error leyendo .env.local:', error.message);
    process.exit(1);
}

// Verificar variables de entorno
const hasGoogleMapsKey = envContent.includes('GOOGLE_MAPS_API_KEY=');
const hasNextPublicKey = envContent.includes('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=');

if (!hasGoogleMapsKey) {
    console.log('❌ Falta GOOGLE_MAPS_API_KEY en .env.local');
    console.log('💡 Agrega: GOOGLE_MAPS_API_KEY=tu_api_key_real');
}

if (!hasNextPublicKey) {
    console.log('❌ Falta NEXT_PUBLIC_GOOGLE_MAPS_API_KEY en .env.local');
    console.log('💡 Agrega: NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=tu_api_key_real');
}

if (hasGoogleMapsKey && hasNextPublicKey) {
    console.log('✅ Variables de entorno configuradas');

    // Verificar que no sean placeholders
    const lines = envContent.split('\n');
    let apiKey = '';

    for (const line of lines) {
        if (line.startsWith('GOOGLE_MAPS_API_KEY=')) {
            apiKey = line.split('=')[1];
            break;
        }
    }

    if (apiKey === 'TU_API_KEY_REAL' || apiKey === 'TU_API_KEY_AQUI' || apiKey === '') {
        console.log('⚠️  API key parece ser un placeholder');
        console.log('💡 Reemplaza con tu API key real de Google Maps');
        console.log('🔗 Obtén tu API key en: https://console.cloud.google.com/google/maps-apis');
    } else {
        console.log('✅ API key configurada (parece ser real)');
        console.log('🎉 ¡Configuración completa!');
        console.log('\n📋 Próximos pasos:');
        console.log('1. Reinicia tu servidor: npm run dev');
        console.log('2. Ve a /google-maps-setup para probar la API key');
        console.log('3. Configura la ubicación de tu estacionamiento');
    }
}

console.log('\n🔍 Verificando archivos del proyecto...');

// Verificar archivos críticos
const criticalFiles = [
    'components/google-map.tsx',
    'components/parking-config.tsx',
    'app/google-maps-setup/page.tsx',
    'app/api/google-maps/setup/route.ts',
    'app/api/geocoding/search/route.ts'
];

let allFilesExist = true;
for (const file of criticalFiles) {
    if (fs.existsSync(path.join(__dirname, file))) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - NO ENCONTRADO`);
        allFilesExist = false;
    }
}

if (allFilesExist) {
    console.log('\n🎉 ¡Todos los archivos necesarios están presentes!');
    console.log('\n🚀 Funcionalidades disponibles:');
    console.log('   • ✅ Google Maps con mapas interactivos');
    console.log('   • ✅ Configuración automática de API key');
    console.log('   • ✅ Búsqueda de direcciones');
    console.log('   • ✅ Autocompletado inteligente en tiempo real');
    console.log('   • ✅ Navegación por teclado');
    console.log('   • ✅ Coordenadas GPS automáticas');
} else {
    console.log('\n⚠️  Algunos archivos faltan. Revisa la instalación.');
}

console.log('\n📚 Para más información, lee: GOOGLE_MAPS_README.md');
