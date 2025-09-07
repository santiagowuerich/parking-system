// Script de prueba para el sistema de plantillas
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000'; // Ajustar según el puerto de desarrollo

async function testPlantillasAPI() {
    console.log('🚀 Iniciando pruebas del sistema de plantillas...\n');

    try {
        // 1. Test GET - Obtener características
        console.log('📋 Test 1: Obtener características disponibles');
        const caracteristicasRes = await fetch(`${BASE_URL}/api/caracteristicas`);
        const caracteristicasData = await caracteristicasRes.json();

        if (caracteristicasRes.ok) {
            console.log('✅ Características obtenidas correctamente');
            console.log(`   📊 Total de características: ${caracteristicasData.caracteristicas?.length || 0}`);

            // Mostrar tipos de características disponibles
            const tipos = [...new Set(caracteristicasData.caracteristicas?.map(c => c.caracteristica_tipos.nombre_tipo))];
            console.log(`   🏷️  Tipos disponibles: ${tipos.join(', ')}\n`);
        } else {
            console.log('❌ Error obteniendo características:', caracteristicasData.error);
        }

        // 2. Test GET - Obtener plantillas existentes
        console.log('📋 Test 2: Obtener plantillas existentes');
        const plantillasRes = await fetch(`${BASE_URL}/api/plantillas?est_id=1`);
        const plantillasData = await plantillasRes.json();

        if (plantillasRes.ok) {
            console.log('✅ Plantillas obtenidas correctamente');
            console.log(`   📊 Total de plantillas: ${plantillasData.plantillas?.length || 0}`);

            if (plantillasData.plantillas?.length > 0) {
                console.log('   📝 Plantillas existentes:');
                plantillasData.plantillas.forEach(p => {
                    console.log(`      - ${p.nombre_plantilla} (${p.catv_segmento})`);
                });
            }
            console.log('');
        } else {
            console.log('❌ Error obteniendo plantillas:', plantillasData.error);
        }

        // 3. Test POST - Crear plantilla nueva (debería funcionar)
        console.log('📋 Test 3: Crear plantilla nueva');
        const nuevaPlantilla = {
            est_id: 1,
            nombre_plantilla: 'Auto Estándar Test',
            catv_segmento: 'AUT',
            caracteristica_ids: [1, 4] // Características de ejemplo
        };

        const createRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nuevaPlantilla)
        });

        const createData = await createRes.json();

        if (createRes.ok) {
            console.log('✅ Plantilla creada correctamente');
            console.log(`   🆔 ID de plantilla: ${createData.plantilla?.plantilla_id}`);
            console.log('');
        } else {
            console.log('❌ Error creando plantilla:', createData.error);
            console.log('');
        }

        // 4. Test POST - Intentar crear plantilla duplicada (debería fallar)
        console.log('📋 Test 4: Intentar crear plantilla duplicada (debería fallar)');
        const plantillaDuplicada = {
            est_id: 1,
            nombre_plantilla: 'Auto Estándar Test', // Mismo nombre
            catv_segmento: 'AUT',
            caracteristica_ids: [1, 4] // Mismas características
        };

        const duplicateRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(plantillaDuplicada)
        });

        const duplicateData = await duplicateRes.json();

        if (duplicateRes.status === 409) {
            console.log('✅ Validación de duplicados funcionando correctamente');
            console.log('   🚫 Error esperado:', duplicateData.error);
            console.log('');
        } else if (duplicateRes.ok) {
            console.log('⚠️  Advertencia: Se permitió crear plantilla duplicada');
            console.log('');
        } else {
            console.log('❌ Error inesperado:', duplicateData.error);
            console.log('');
        }

        // 5. Test POST - Crear plantilla con nombre duplicado pero diferentes características (debería fallar)
        console.log('📋 Test 5: Intentar crear plantilla con nombre duplicado');
        const nombreDuplicado = {
            est_id: 1,
            nombre_plantilla: 'Auto Estándar Test', // Mismo nombre
            catv_segmento: 'AUT',
            caracteristica_ids: [2, 5] // Diferentes características
        };

        const nombreDupRes = await fetch(`${BASE_URL}/api/plantillas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(nombreDuplicado)
        });

        const nombreDupData = await nombreDupRes.json();

        if (nombreDupRes.status === 409) {
            console.log('✅ Validación de nombre duplicado funcionando correctamente');
            console.log('   🚫 Error esperado:', nombreDupData.error);
            console.log('');
        } else {
            console.log('❌ Error: Se permitió nombre duplicado');
            console.log('');
        }

        // 6. Test DELETE - Limpiar plantilla de prueba (si existe)
        if (createData.plantilla?.plantilla_id) {
            console.log('📋 Test 6: Limpiar plantilla de prueba');
            const deleteRes = await fetch(`${BASE_URL}/api/plantillas`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plantilla_id: createData.plantilla.plantilla_id })
            });

            const deleteData = await deleteRes.json();

            if (deleteRes.ok) {
                console.log('✅ Plantilla de prueba eliminada correctamente');
                console.log('');
            } else {
                console.log('❌ Error eliminando plantilla de prueba:', deleteData.error);
                console.log('');
            }
        }

        console.log('🎉 Pruebas completadas!');

    } catch (error) {
        console.error('💥 Error durante las pruebas:', error.message);
    }
}

// Ejecutar pruebas
testPlantillasAPI();
