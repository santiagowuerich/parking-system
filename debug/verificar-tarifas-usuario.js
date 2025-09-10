/**
 * Script para verificar las tarifas del usuario
 */

// Función para verificar tarifas por establecimiento
async function verificarTarifas() {
    console.log('🔍 VERIFICANDO TARIFAS POR ESTABLECIMIENTO\n');

    // Establecimientos con ocupaciones activas
    const establecimientosActivos = [11, 52, 79];

    // Establecimientos con la configuración correcta
    const establecimientosCorrectos = [66, 78];

    const todosEstablecimientos = [...establecimientosActivos, ...establecimientosCorrectos];

    for (const estId of todosEstablecimientos) {
        console.log(`🏢 ESTABLECIMIENTO ${estId}:`);

        try {
            const response = await fetch(`http://localhost:3000/api/tarifas?est_id=${estId}`);
            if (!response.ok) {
                console.log(`   ❌ Error al consultar tarifas`);
                continue;
            }

            const data = await response.json();
            const tarifasAuto = data.tarifas?.filter(t => t.catv_segmento === 'AUT') || [];

            if (tarifasAuto.length === 0) {
                console.log(`   ⚠️  No hay tarifas configuradas para Auto`);
                continue;
            }

            console.log(`   📋 Tarifas para Auto:`);
            const tipos = { 1: 'Hora', 2: 'Día', 3: 'Mes', 4: 'Semana' };

            for (const tarifa of tarifasAuto) {
                const tipo = tipos[tarifa.tiptar_nro] || `Tipo ${tarifa.tiptar_nro}`;
                console.log(`      ${tipo}: $${tarifa.tarifas?.[tarifa.tiptar_nro]?.precio || 'N/A'}`);
            }

            // Verificar si coincide con la configuración esperada
            const configuracionEsperada = {
                1: 100, // Hora
                2: 200, // Día
                3: 400, // Mes
                4: 300  // Semana
            };

            let coincide = true;
            for (const [tipo, precioEsperado] of Object.entries(configuracionEsperada)) {
                const tarifaEncontrada = tarifasAuto.find(t => t.tiptar_nro == tipo);
                const precioActual = tarifaEncontrada?.tarifas?.[tipo]?.precio;
                if (precioActual != precioEsperado) {
                    coincide = false;
                    break;
                }
            }

            if (coincide) {
                console.log(`   ✅ CONFIGURACIÓN CORRECTA`);
            } else {
                console.log(`   ❌ Configuración diferente`);
            }

        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }

        console.log('');
    }

    console.log('💡 RECOMENDACIÓN:');
    console.log('   Si quieres usar las tarifas correctas (hora:100, día:200, semana:300, mes:400),');
    console.log('   necesitas cambiar al establecimiento 78 o actualizar las tarifas del establecimiento actual.');
}

// Ejecutar verificación
if (require.main === module) {
    verificarTarifas();
}

module.exports = { verificarTarifas };
