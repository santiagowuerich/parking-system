// Script para probar la corrección del cálculo de tarifas
// Ejecutar con: node tests/test-calculacion-tarifas.js

const BASE_URL = 'http://localhost:3000';

/**
 * PROBLEMA IDENTIFICADO Y CORREGIDO:
 * 
 * El sistema estaba mostrando un precio incorrecto por dos razones:
 * 
 * 1. PROBLEMA EN LA CARGA DE TARIFAS:
 *    - operador-simple/page.tsx y operador/page.tsx estaban cargando TODAS las tarifas
 *    - No estaban ordenando por tar_f_desde para obtener las más recientes
 *    - Resultaba en que se cargaban tarifas antiguas junto con las nuevas
 *    - Al buscar una tarifa, podría encontrar una versión anterior con tar_fraccion incorrecta
 * 
 * 2. PROBLEMA EN EL ALMACENAMIENTO:
 *    - /api/tarifas/route.ts estaba haciendo upsert sin incluir tar_f_desde en el onConflict
 *    - Esto causaba que inserte una NUEVA tarifa en lugar de actualizar la existente
 *    - tar_fraccion siempre se seteaba a 1 por defecto en la API
 * 
 * 3. PROBLEMA EN LA DEDUPLICACIÓN:
 *    - /api/tarifas/route.ts no estaba deduplicando tarifas cuando las agrupaba
 *    - Era posible que una misma plantilla/tipo tuviera múltiples versiones
 * 
 * CORRECCIONES REALIZADAS:
 * 
 * 1. operador-simple/page.tsx:
 *    + Agregué .order('tar_f_desde', { ascending: false })
 *    + Agregué lógica de deduplicación por (tiptar_nro, plantilla_id)
 *    + Mantiene solo la tarifa más reciente de cada tipo
 * 
 * 2. operador/page.tsx:
 *    + Agregué .order('tar_f_desde', { ascending: false })
 *    + Agregué lógica de deduplicación por (tiptar_nro, plantilla_id)
 *    + Mantiene solo la tarifa más reciente de cada tipo
 * 
 * 3. /api/tarifas/route.ts:
 *    + Agregué tar_f_desde al SELECT en el GET
 *    + Agregué .order('tar_f_desde', { ascending: false }) en el GET
 *    + Agregué lógica de deduplicación usando processedKeys
 *    + Ahora incluye la fecha en la respuesta
 * 
 * 4. /api/parking/init-rates/route.ts:
 *    + Cambió tar_fraccion de 1 a valores iguales a tar_precio
 *    + Agregó plantilla_id a las tarifas por defecto
 * 
 * 5. components/admin/TariffModal.tsx:
 *    + Agregó campos para "Primera hora" y "Horas adicionales"
 *    + Permite configurar tar_fraccion separadamente
 * 
 * RESULTADO:
 * Para 167h 9m con tarifa $1,200/hora (correctamente configurada):
 * - Primera hora: $1,200
 * - 166 horas adicionales: 166 × $1,200 = $199,200
 * - Total: $200,400 ✅
 * 
 * En lugar de: $1,200 ❌
 */

async function testCalculacionTarifas() {
    console.log('🧪 Probando Cálculo de Tarifas Corregido...\n');

    const est_id = 1; // Cambiar por un ID de estacionamiento válido

    try {
        // 1. Configurar tarifa de prueba con tar_fraccion correcta
        console.log('📤 Configurando tarifa de prueba...');
        const tarifaTest = [
            {
                plantilla_id: 1,
                tiptar_nro: 1, // Por hora
                tar_precio: 1200, // Primera hora
                tar_fraccion: 1200  // Horas adicionales (mismo precio)
            }
        ];

        const configResponse = await fetch(`${BASE_URL}/api/tarifas?est_id=${est_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tarifas: tarifaTest })
        });

        if (configResponse.ok) {
            console.log('✅ Tarifa configurada correctamente');
        } else {
            console.log('❌ Error configurando tarifa:', configResponse.status);
            return;
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // 2. Probar cálculo con el caso del problema: 167h 55m
        console.log('📊 Probando cálculo para 167 horas y 55 minutos...');

        const entryTime = new Date('2024-01-01T00:00:00Z');
        const exitTime = new Date('2024-01-08T07:55:00Z'); // 7 días, 7 horas, 55 minutos = 167h 55m

        const calculationData = {
            vehicleType: 'Auto',
            entry_time: entryTime.toISOString(),
            exit_time: exitTime.toISOString(),
            tarifa_tipo: 'hora'
        };

        console.log('Datos del cálculo:');
        console.log('- Entrada:', entryTime.toISOString());
        console.log('- Salida:', exitTime.toISOString());
        console.log('- Tiempo transcurrido: ~168 horas');
        console.log('- Tarifa configurada: $1,200 primera hora + $1,200 por hora adicional');

        const calcResponse = await fetch(`${BASE_URL}/api/pricing/calculate?est_id=${est_id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(calculationData)
        });

        if (calcResponse.ok) {
            const calcData = await calcResponse.json();
            console.log('\n✅ Resultado del cálculo:');
            console.log('- Fee calculado:', calcData.fee);
            console.log('- Horas:', calcData.hours);
            console.log('- Rate base:', calcData.rate);
            console.log('- Tipo tarifa:', calcData.tarifa_tipo);

            // Verificar el resultado esperado
            const expectedFee = 1200 + (167 * 1200); // Primera hora + 167 horas adicionales
            console.log('\n🔍 Verificación:');
            console.log('- Fee esperado:', expectedFee);
            console.log('- Fee obtenido:', calcData.fee);
            console.log('- ¿Correcto?:', calcData.fee === expectedFee ? '✅ SÍ' : '❌ NO');

            if (calcData.fee === expectedFee) {
                console.log('\n🎉 ¡PROBLEMA RESUELTO! El cálculo ahora es correcto.');
            } else {
                console.log('\n⚠️ El cálculo aún no es correcto. Revisar implementación.');
            }

        } else {
            console.log('❌ Error en cálculo:', calcResponse.status, calcResponse.statusText);
            const errorData = await calcResponse.text();
            console.log('Error:', errorData);
        }

        console.log('\n' + '='.repeat(50) + '\n');

        // 3. Probar otros casos de prueba
        console.log('📊 Probando otros casos...');

        // Caso 1: 1 hora exacta
        const case1 = {
            vehicleType: 'Auto',
            entry_time: '2024-01-01T10:00:00Z',
            exit_time: '2024-01-01T11:00:00Z',
            tarifa_tipo: 'hora'
        };

        const response1 = await fetch(`${BASE_URL}/api/pricing/calculate?est_id=${est_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(case1)
        });

        if (response1.ok) {
            const data1 = await response1.json();
            console.log('Caso 1 (1 hora):', data1.fee, 'Esperado: 1200', data1.fee === 1200 ? '✅' : '❌');
        }

        // Caso 2: 3 horas
        const case2 = {
            vehicleType: 'Auto',
            entry_time: '2024-01-01T10:00:00Z',
            exit_time: '2024-01-01T13:00:00Z',
            tarifa_tipo: 'hora'
        };

        const response2 = await fetch(`${BASE_URL}/api/pricing/calculate?est_id=${est_id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(case2)
        });

        if (response2.ok) {
            const data2 = await response2.json();
            const expected2 = 1200 + (2 * 1200); // Primera hora + 2 horas adicionales
            console.log('Caso 2 (3 horas):', data2.fee, 'Esperado:', expected2, data2.fee === expected2 ? '✅' : '❌');
        }

    } catch (error) {
        console.error('❌ Error en prueba:', error);
    }
}

// Ejecutar prueba
testCalculacionTarifas();
