// Script para probar la nueva API de tarifas
// Ejecutar con: node test-tarifas-api.js

const BASE_URL = 'http://localhost:3000';

async function testTarifasAPI() {
    console.log('🧪 Probando API de Tarifas...\n');

    // Datos de prueba
    const est_id = 1; // Cambiar por un ID de estacionamiento válido

    try {
        // 1. Probar GET - Obtener tarifas
        console.log('📥 Probando GET /api/tarifas?est_id=' + est_id);
        const getResponse = await fetch(`${BASE_URL}/api/tarifas?est_id=${est_id}`);

        if (getResponse.ok) {
            const getData = await getResponse.json();
            console.log('✅ GET exitoso:');
            console.log(JSON.stringify(getData, null, 2));
        } else {
            console.log('❌ Error en GET:', getResponse.status, getResponse.statusText);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // 2. Probar POST - Crear/Actualizar tarifas
        const tarifasData = [
            {
                plantilla_id: 1,
                tiptar_nro: 1, // Por hora
                tar_precio: 50.00
            },
            {
                plantilla_id: 1,
                tiptar_nro: 2, // Por día
                tar_precio: 300.00
            },
            {
                plantilla_id: 2,
                tiptar_nro: 1, // Por hora
                tar_precio: 75.00
            }
        ];

        console.log('📤 Probando POST /api/tarifas?est_id=' + est_id);
        console.log('Datos a enviar:', JSON.stringify(tarifasData, null, 2));

        const postResponse = await fetch(`${BASE_URL}/api/tarifas?est_id=${est_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tarifas: tarifasData })
        });

        if (postResponse.ok) {
            const postData = await postResponse.json();
            console.log('✅ POST exitoso:');
            console.log(JSON.stringify(postData, null, 2));
        } else {
            const errorText = await postResponse.text();
            console.log('❌ Error en POST:', postResponse.status, postResponse.statusText);
            console.log('Respuesta de error:', errorText);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // 3. Verificar que los cambios se guardaron (GET después del POST)
        console.log('🔄 Verificando cambios con GET después del POST...');
        const verifyResponse = await fetch(`${BASE_URL}/api/tarifas?est_id=${est_id}`);

        if (verifyResponse.ok) {
            const verifyData = await verifyResponse.json();
            console.log('✅ Verificación exitosa:');
            console.log(JSON.stringify(verifyData, null, 2));
        } else {
            console.log('❌ Error en verificación:', verifyResponse.status, verifyResponse.statusText);
        }

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

// Ejecutar la prueba
testTarifasAPI();

