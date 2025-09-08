// Script de prueba para el endpoint /api/zonas/configurar
const fetch = require('node-fetch');

async function testCrearZona() {
    const testData = {
        est_id: 1,
        zona_nombre: "Zona Prueba",
        cantidad_plazas: 10,
        catv_segmento: "AUT",
        numeracion: {
            modo: "reiniciar"
        }
    };

    try {
        console.log('🚀 Probando creación de zona con plazas...');
        console.log('📤 Datos de prueba:', JSON.stringify(testData, null, 2));

        const response = await fetch('http://localhost:3000/api/zonas/configurar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        console.log('📥 Respuesta del servidor:');
        console.log('Status:', response.status);
        console.log('Resultado:', JSON.stringify(result, null, 2));

        if (response.ok && result.success) {
            console.log('✅ ¡Prueba exitosa! Zona creada correctamente');
        } else {
            console.log('❌ Prueba fallida:', result.error);
        }

    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
    }
}

// Ejecutar prueba
testCrearZona();
