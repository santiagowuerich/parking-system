#!/usr/bin/env node

/**
 * Script para ejecutar todos los tests de integración
 * Uso: node scripts/run-integration-tests.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Ejecutando Tests de Integración del Sistema de Parking\n');

// Verificar que el servidor esté corriendo
console.log('1️⃣ Verificando servidor...');
try {
    const response = execSync('curl -s http://localhost:3000/api/health', { timeout: 5000 });
    console.log('✅ Servidor corriendo en localhost:3000');
} catch (error) {
    console.log('❌ Servidor no disponible. Ejecuta: npm run dev');
    process.exit(1);
}

// Obtener todos los archivos de test de integración
const testsDir = path.join(__dirname, '..', 'tests');
const testFiles = fs.readdirSync(testsDir)
    .filter(file => file.startsWith('test-') && file.endsWith('.js'))
    .filter(file => !file.includes('unit')) // Excluir unit tests
    .sort();

console.log('2️⃣ Ejecutando tests de integración...\n');

let passed = 0;
let failed = 0;
const results = [];

for (const testFile of testFiles) {
    const testPath = path.join(testsDir, testFile);

    try {
        console.log(`🔄 Ejecutando: ${testFile}`);
        execSync(`node "${testPath}"`, {
            stdio: 'inherit',
            timeout: 30000 // 30 segundos timeout por test
        });

        console.log(`✅ ${testFile} - PASSED\n`);
        passed++;
        results.push({ file: testFile, status: 'PASSED' });

    } catch (error) {
        console.log(`❌ ${testFile} - FAILED\n`);
        failed++;
        results.push({ file: testFile, status: 'FAILED', error: error.message });
    }
}

// Mostrar resumen
console.log('📊 RESUMEN DE TESTS:\n');
console.log(`Total: ${testFiles.length}`);
console.log(`✅ Pasaron: ${passed}`);
console.log(`❌ Fallaron: ${failed}`);
console.log(`📈 Tasa de éxito: ${((passed / testFiles.length) * 100).toFixed(1)}%\n`);

if (failed > 0) {
    console.log('🔍 TESTS FALLIDOS:\n');
    results.filter(r => r.status === 'FAILED').forEach(result => {
        console.log(`❌ ${result.file}`);
        console.log(`   Error: ${result.error}\n`);
    });
}

if (passed === testFiles.length) {
    console.log('🎉 ¡Todos los tests pasaron exitosamente!\n');
} else {
    console.log('⚠️ Algunos tests fallaron. Revisa los logs arriba.\n');
    process.exit(1);
}
