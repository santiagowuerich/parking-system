// Script para verificar la configuración de Supabase y consultar empleados
const fs = require('fs');
const path = require('path');

console.log('🔍 Verificando configuración de Supabase...');

// Buscar archivos de configuración
function findConfigFiles(dir) {
    const files = [];
    const items = fs.readdirSync(dir);

    for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
            files.push(...findConfigFiles(fullPath));
        } else if (item.includes('supabase') || item.includes('config') || item.includes('env')) {
            files.push(fullPath);
        }
    }

    return files;
}

try {
    const configFiles = findConfigFiles('.');
    console.log('📁 Archivos de configuración encontrados:');
    configFiles.forEach(file => console.log('  -', file));

    // Buscar variables de entorno en archivos .env
    const envFiles = ['.env', '.env.local', '.env.development', '.env.production'];
    envFiles.forEach(envFile => {
        try {
            if (fs.existsSync(envFile)) {
                console.log('\n📄 Contenido de', envFile + ':');
                const content = fs.readFileSync(envFile, 'utf8');
                const lines = content.split('\n').filter(line =>
                    line.includes('SUPABASE') ||
                    line.includes('DATABASE') ||
                    line.includes('PROJECT')
                );
                lines.forEach(line => console.log('  ', line));
            }
        } catch (e) {
            // Ignorar errores
        }
    });
} catch (error) {
    console.error('❌ Error al verificar configuración:', error.message);
}
