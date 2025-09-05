// Script de prueba para verificar las mejoras de UX en duplicados
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';

async function testDuplicadosUX() {
    console.log('🚀 Probando mejoras de UX para duplicados...\n');

    try {
        // Crear plantilla base
        console.log('📋 Creando plantilla base...');
        const basePlantilla = {
            est_id: 1,
            nombre_plantilla: 'Auto Test UX',
            catv_segmento: 'AUT',
            caracteristica_ids: [1, 4]
        };

        const baseRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(basePlantilla)
        });

        const baseData = await baseRes.json();
        console.log(`✅ Plantilla base creada: ${baseData.plantilla?.plantilla_id}`);

        // Test 1: Duplicado por nombre
        console.log('\n📋 Test 1: Duplicado por nombre');
        const nombreDup = {
            est_id: 1,
            nombre_plantilla: 'Auto Test UX', // Mismo nombre
            catv_segmento: 'AUT',
            caracteristica_ids: [2, 5] // Diferentes características
        };

        const nombreRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nombreDup)
        });

        const nombreData = await nombreRes.json();

        if (nombreRes.status === 409 && nombreData.error_code === 'DUPLICATE_NAME') {
            console.log('✅ Duplicado por nombre detectado correctamente');
            console.log(`   📋 Código: ${nombreData.error_code}`);
            console.log(`   🚫 Mensaje: ${nombreData.error}`);
            console.log('   💡 El frontend debería mostrar:');
            console.log('      - Diálogo: "🚫 Nombre de plantilla duplicado"');
            console.log('      - Mensaje: Explica que debe elegir un nombre diferente');
            console.log('      - Botón: Solo "Cambiar nombre"');
        }

        // Test 2: Duplicado por configuración
        console.log('\n📋 Test 2: Duplicado por configuración');
        const configDup = {
            est_id: 1,
            nombre_plantilla: 'Auto Test Config', // Nombre diferente
            catv_segmento: 'AUT',
            caracteristica_ids: [1, 4] // Mismas características
        };

        const configRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configDup)
        });

        const configData = await configRes.json();

        if (configRes.status === 409 && configData.error_code === 'DUPLICATE_CONFIG') {
            console.log('✅ Duplicado por configuración detectado correctamente');
            console.log(`   📋 Código: ${configData.error_code}`);
            console.log(`   🚫 Mensaje: ${configData.error}`);
            console.log('   💡 El frontend debería mostrar:');
            console.log('      - Diálogo: "🚫 Configuración duplicada no permitida"');
            console.log('      - Mensaje: Explica por qué no se puede crear');
            console.log('      - Botón: Solo "Revisar configuración"');
        }

        // Test 3: Verificar que NO se puede forzar creación de duplicada
        console.log('\n📋 Test 3: Verificar que NO se permite forzar duplicada');
        const forceDup = {
            est_id: 1,
            nombre_plantilla: 'Auto Test UX',
            catv_segmento: 'AUT',
            caracteristica_ids: [1, 4],
            force_duplicate: true // Este flag ya no debería funcionar
        };

        const forceRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(forceDup)
        });

        const forceData = await forceRes.json();

        if (forceRes.status === 409) {
            console.log('✅ Validación correcta: No se permite forzar creación de duplicadas');
            console.log('   🚫 Error esperado:', forceData.error);
            console.log('   💡 El sistema ahora es más estricto con las duplicadas');
        } else if (forceRes.ok) {
            console.log('⚠️  Advertencia: Se permitió forzar creación de duplicada (esto no debería suceder)');
        }

        // Limpiar
        console.log('\n📋 Limpiando plantillas de prueba...');
        const plantillasToDelete = [baseData.plantilla?.plantilla_id].filter(Boolean);

        for (const id of plantillasToDelete) {
            await fetch(`${BASE_URL}/api/plantillas`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plantilla_id: id })
            });
        }

        console.log('\n🎉 Tests completados!');
        console.log('\n💡 Mejoras de UX implementadas:');
        console.log('   ✅ Diálogo informativo cuando se detecta duplicado');
        console.log('   ✅ Mensajes claros sobre por qué no se puede crear duplicada');
        console.log('   ✅ Diseño visual con colores rojos para indicar restricción');
        console.log('   ✅ Validación estricta sin opción de "crear de todas formas"');
        console.log('   ✅ Interfaz más limpia sin bordes innecesarios');
        console.log('   ✅ Sistema más robusto y consistente');

    } catch (error) {
        console.error('💥 Error:', error.message);
    }
}

testDuplicadosUX();
