#!/usr/bin/env node

/**
 * Script de verificación de correcciones de seguridad
 * Verifica que getSession() haya sido reemplazado por getUser()
 */

console.log('🔐 Verificando correcciones de seguridad...\n');

// Verificar archivos corregidos
const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'middleware.ts',
    'app/api/auth/setup-parking/route.ts',
    'app/api/auth/get-parking-id/route.ts',
    'app/api/auth/list-parkings/route.ts',
    'app/api/auth/migrate-existing/route.ts',
    'app/api/estacionamiento/config/route.ts'
];

let allFilesCorrect = true;

console.log('📁 Verificando archivos corregidos:\n');

for (const filePath of filesToCheck) {
    if (fs.existsSync(path.join(__dirname, filePath))) {
        const content = fs.readFileSync(path.join(__dirname, filePath), 'utf8');

        const hasGetSession = content.includes('getSession()');
        const hasGetUser = content.includes('getUser()');

        if (hasGetSession) {
            console.log(`❌ ${filePath} - AÚN TIENE getSession()`);
            allFilesCorrect = false;
        } else if (hasGetUser) {
            console.log(`✅ ${filePath} - Corregido (usa getUser)`);
        } else {
            console.log(`⚠️  ${filePath} - No tiene métodos de autenticación`);
        }
    } else {
        console.log(`❌ ${filePath} - NO ENCONTRADO`);
        allFilesCorrect = false;
    }
}

console.log('\n🔍 Verificando que no queden usos de getSession() en rutas de API:\n');

const apiContent = fs.readdirSync(path.join(__dirname, 'app/api'), { recursive: true })
    .filter(file => file.endsWith('.ts'))
    .map(file => path.join(__dirname, 'app/api', file))
    .filter(filePath => fs.existsSync(filePath))
    .map(filePath => ({
        path: filePath,
        content: fs.readFileSync(filePath, 'utf8')
    }));

let remainingGetSession = 0;

for (const file of apiContent) {
    if (file.content.includes('getSession()')) {
        console.log(`⚠️  ${file.path.replace(__dirname + '/', '')} - Aún tiene getSession()`);
        remainingGetSession++;
    }
}

if (remainingGetSession === 0) {
    console.log('✅ No se encontraron usos restantes de getSession() en rutas de API');
}

console.log('\n🎯 Resumen de seguridad:\n');

if (allFilesCorrect && remainingGetSession === 0) {
    console.log('✅ TODAS LAS CORRECCIONES APLICADAS CORRECTAMENTE');
    console.log('🔒 Tu aplicación ahora es más segura');
    console.log('🚫 No más advertencias de Supabase sobre getSession()');

    console.log('\n📋 Beneficios de la corrección:');
    console.log('   • ✅ Verificación de autenticidad en el servidor');
    console.log('   • ✅ Protección contra manipulación de cookies');
    console.log('   • ✅ Mayor seguridad en endpoints críticos');
    console.log('   • ✅ Cumplimiento con mejores prácticas de Supabase');

} else {
    console.log('⚠️  Aún quedan correcciones pendientes');
    console.log(`   • Archivos con getSession(): ${remainingGetSession}`);
}

console.log('\n🚀 Para verificar:');
console.log('1. Reinicia el servidor: npm run dev');
console.log('2. Revisa la consola por advertencias de Supabase');
console.log('3. Las advertencias sobre getSession() deberían desaparecer');

console.log('\n📚 Para más información, lee: GOOGLE_MAPS_README.md');

