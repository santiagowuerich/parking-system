#!/usr/bin/env node

/**
 * Script para configurar variables de entorno
 * Uso: node setup-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, resolve);
    });
}

async function setupEnvironment() {
    console.log('🚀 Configuración de Variables de Entorno');
    console.log('=====================================');
    console.log('');

    // Google Maps API Key
    console.log('🗺️  Google Maps API Key');
    console.log('Si no tienes una API key, puedes obtenerla en:');
    console.log('https://console.cloud.google.com/google/maps-apis');
    console.log('');

    const googleApiKey = await ask('Ingresa tu Google Maps API Key (o presiona Enter para omitir): ');

    // Supabase URLs
    console.log('');
    console.log('🗄️  Configuración de Supabase');
    const supabaseUrl = await ask('Ingresa tu Supabase URL (o presiona Enter para usar valor por defecto): ');
    const supabaseAnonKey = await ask('Ingresa tu Supabase Anon Key (o presiona Enter para usar valor por defecto): ');

    // Crear contenido del archivo
    let envContent = '# Configuración del Sistema de Estacionamientos\n';

    if (googleApiKey.trim()) {
        envContent += '\n# Google Maps Configuration\n';
        envContent += `GOOGLE_MAPS_API_KEY=${googleApiKey.trim()}\n`;
        envContent += `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=${googleApiKey.trim()}\n`;
    }

    envContent += '\n# Supabase Configuration\n';
    if (supabaseUrl.trim()) {
        envContent += `NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl.trim()}\n`;
    } else {
        envContent += 'NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here\n';
    }

    if (supabaseAnonKey.trim()) {
        envContent += `NEXT_PUBLIC_SUPABASE_ANON_KEY=${supabaseAnonKey.trim()}\n`;
    } else {
        envContent += 'NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here\n';
    }

    envContent += '\n# App Configuration\n';
    envContent += 'NEXT_PUBLIC_APP_URL=http://localhost:3000\n';

    // Crear archivo
    const envPath = path.join(__dirname, '.env.local');

    try {
        fs.writeFileSync(envPath, envContent);
        console.log('');
        console.log('✅ Archivo .env.local creado exitosamente!');
        console.log('📍 Ubicación:', envPath);
        console.log('');
        console.log('📋 Resumen de configuración:');

        if (googleApiKey.trim()) {
            console.log('✅ Google Maps API Key configurada');
        } else {
            console.log('⚠️  Google Maps API Key no configurada');
        }

        if (supabaseUrl.trim() && supabaseAnonKey.trim()) {
            console.log('✅ Supabase configurado');
        } else {
            console.log('⚠️  Supabase no configurado completamente');
        }

        console.log('');
        console.log('🔄 Próximos pasos:');
        console.log('1. npm run dev (reiniciar el servidor)');
        console.log('2. Ve a /google-maps-setup para verificar la configuración');
        console.log('3. Ve a Mis Estacionamientos → Configuración para probar Google Maps');

    } catch (error) {
        console.error('');
        console.error('❌ Error creando archivo .env.local:', error.message);
        console.log('');
        console.log('💡 Puedes crear el archivo manualmente con este contenido:');
        console.log('================================================');
        console.log(envContent);
    }

    rl.close();
}

setupEnvironment().catch(console.error);







