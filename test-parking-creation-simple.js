// Script de prueba para verificar creación de estacionamientos
// Ejecutar desde la consola del navegador en /dashboard/parking

async function testParkingCreation() {
    console.log('🧪 Probando creación de estacionamientos sin validación tradicional...');

    const testData = {
        name: 'Estacionamiento Test ' + new Date().toISOString().split('T')[0],
        direccion: 'Dirección de prueba única ' + Date.now()
    };

    try {
        // Probar endpoint principal
        console.log('📤 Probando endpoint principal...');
        const response1 = await fetch('/api/auth/create-new-parking', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
        });

        if (response1.ok) {
            const data = await response1.json();
            console.log('✅ Endpoint principal funciona:', data);
            return data;
        } else {
            const error = await response1.json();
            console.log('⚠️ Endpoint principal falló:', error);

            // Probar endpoint fallback
            console.log('📤 Probando endpoint fallback...');
            const response2 = await fetch('/api/auth/create-new-parking-fallback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(testData),
            });

            if (response2.ok) {
                const data = await response2.json();
                console.log('✅ Endpoint fallback funciona:', data);
                return data;
            } else {
                const error2 = await response2.json();
                console.log('❌ Ambos endpoints fallaron:', error2);
                return null;
            }
        }
    } catch (error) {
        console.error('❌ Error en la prueba:', error);
        return null;
    }
}

// Para ejecutar: copiar y pegar en la consola del navegador
// testParkingCreation()
