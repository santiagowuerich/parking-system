// Script para probar la nueva interfaz de gestión de tarifas
// Ejecutar con: node test-tarifas-ui.js

const BASE_URL = 'http://localhost:3000';

async function testTarifasUI() {
    console.log('🧪 Probando Interfaz de Gestión de Tarifas...\n');

    // Datos de prueba
    const est_id = 1; // Cambiar por un ID de estacionamiento válido

    try {
        // 1. Verificar que la API de plantillas funciona
        console.log('📋 Probando carga de plantillas...');
        const plantillasResponse = await fetch(`${BASE_URL}/api/plantillas?est_id=${est_id}`);

        if (plantillasResponse.ok) {
            const plantillasData = await plantillasResponse.json();
            console.log('✅ Plantillas cargadas:', plantillasData.plantillas?.length || 0, 'plantillas');

            if (plantillasData.plantillas?.length > 0) {
                const primeraPlantilla = plantillasData.plantillas[0];
                console.log('📝 Primera plantilla:', primeraPlantilla.nombre_plantilla);

                // 2. Probar guardar tarifas para la primera plantilla
                const tarifasData = [
                    {
                        plantilla_id: primeraPlantilla.plantilla_id,
                        tiptar_nro: 1, // Por hora
                        tar_precio: 75.00
                    },
                    {
                        plantilla_id: primeraPlantilla.plantilla_id,
                        tiptar_nro: 2, // Por día
                        tar_precio: 450.00
                    }
                ];

                console.log('\n💰 Probando guardar tarifas...');
                const saveResponse = await fetch(`${BASE_URL}/api/tarifas?est_id=${est_id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ tarifas: tarifasData })
                });

                if (saveResponse.ok) {
                    const saveData = await saveResponse.json();
                    console.log('✅ Tarifas guardadas:', saveData);
                } else {
                    console.log('❌ Error guardando tarifas');
                }

                // 3. Verificar que se cargan las tarifas guardadas
                console.log('\n🔍 Verificando tarifas guardadas...');
                const verifyResponse = await fetch(`${BASE_URL}/api/tarifas?est_id=${est_id}`);

                if (verifyResponse.ok) {
                    const verifyData = await verifyResponse.json();
                    const plantillaConTarifas = verifyData.tarifas?.find(
                        (p: any) => p.plantilla_id === primeraPlantilla.plantilla_id
                    );
                    console.log('✅ Tarifas verificadas para', primeraPlantilla.nombre_plantilla + ':');
                    console.log('   - Hora:', plantillaConTarifas?.tarifas?.['1']?.precio || 'No definido');
                    console.log('   - Día:', plantillaConTarifas?.tarifas?.['2']?.precio || 'No definido');
                }
            } else {
                console.log('⚠️ No hay plantillas disponibles para probar');
            }
        } else {
            console.log('❌ Error cargando plantillas');
        }

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }

    console.log('\n🎉 Prueba completada!');
    console.log('📱 Ahora puedes probar la interfaz en el navegador:');
    console.log(`   ${BASE_URL}/gestion-tarifas`);
}

// Ejecutar la prueba
testTarifasUI();

