/**
 * Ejemplo de uso del endpoint de cálculo de precios
 *
 * FUNCIONALIDAD:
 * =============
 * - Para HORA: calcula tarifa basada en tiempo real (mínimo 1 hora)
 * - Para DÍA/SEMANA/MES: usa precio fijo configurado (sin cálculos adicionales)
 *
 * EJEMPLOS DE USO:
 * ================
 */

// Función para probar un ejemplo específico
async function probarEjemplo(tarifaTipo, horasReales, vehicleType = "Auto") {
    const entryTime = "2024-01-15T10:00:00Z";
    const exitTime = new Date(Date.parse(entryTime) + (horasReales * 60 * 60 * 1000)).toISOString();

    const payload = {
        vehicleType: vehicleType,
        entry_time: entryTime,
        exit_time: exitTime,
        tarifa_tipo: tarifaTipo
    };

    console.log(`\n🚗 Probando: ${vehicleType} con tarifa tipo "${tarifaTipo}"`);
    console.log(`   Tiempo real: ${horasReales} horas`);
    console.log(`   Payload:`, JSON.stringify(payload, null, 2));

    try {
        const response = await fetch('http://localhost:3000/api/pricing/calculate?est_id=1', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error('❌ Error en la respuesta:', response.status, response.statusText);
            return;
        }

        const resultado = await response.json();
        console.log('✅ Resultado:', JSON.stringify(resultado, null, 2));

        // Explicación clara del cálculo
        console.log('\n📊 ANÁLISIS DEL CÁLCULO:');
        console.log(`   - Horas reales transcurridas: ${resultado.hours}h`);
        console.log(`   - Tipo de tarifa: ${resultado.tarifa_tipo}`);
        console.log(`   - Precio base configurado: $${resultado.rate}`);

        if (resultado.tarifa_tipo === 'hora') {
            console.log(`   🔢 Cálculo por hora: precio_base + (tarifa_por_hora × (horas - 1))`);
            console.log(`   💰 TOTAL A COBRAR: $${resultado.fee} (calculado)`);
        } else {
            console.log(`   📋 Precio fijo para ${resultado.tarifa_tipo}`);
            console.log(`   💰 TOTAL A COBRAR: $${resultado.fee} (precio fijo)`);
        }

    } catch (error) {
        console.error('❌ Error al probar el endpoint:', error.message);
    }
}

// Ejecutar ejemplos prácticos
async function ejecutarEjemplos() {
    console.log('🎯 EJEMPLOS DE CÁLCULO DE TARIFAS\n');

    // Ejemplo 1: Cálculo por hora (con cálculo dinámico)
    await probarEjemplo("hora", 2.5, "Auto"); // 2.5 horas de estacionamiento

    // Ejemplo 2: Precio fijo diario (sin importar tiempo real)
    await probarEjemplo("dia", 2, "Auto"); // Solo 2 horas pero paga precio diario completo

    // Ejemplo 3: Precio fijo semanal para moto
    await probarEjemplo("semana", 24, "Moto"); // 1 día pero paga precio semanal completo

    // Ejemplo 4: Precio fijo mensual para camioneta
    await probarEjemplo("mes", 24 * 5, "Camioneta"); // 5 días pero paga precio mensual completo
}

// Función para probar todas las duraciones con un tiempo corto
async function probarDuracionesCortas() {
    console.log('\n🔥 PRUEBA: Comparación con 30 minutos de estacionamiento\n');

    const duraciones = ["hora", "dia", "semana", "mes"];

    for (const duracion of duraciones) {
        await probarEjemplo(duracion, 0.5, "Auto"); // Solo 30 minutos
    }

    console.log('\n📋 RESUMEN DE LA PRUEBA:');
    console.log('   - HORA: Cobra mínimo 1 hora (aunque fueron 30 min)');
    console.log('   - DÍA: Cobra precio diario completo');
    console.log('   - SEMANA: Cobra precio semanal completo');
    console.log('   - MES: Cobra precio mensual completo');
}

// Ejecutar los ejemplos
if (require.main === module) {
    ejecutarEjemplos().then(() => {
        console.log('\n' + '='.repeat(60));
        return probarDuracionesCortas();
    });
}

module.exports = { probarEjemplo, ejecutarEjemplos, probarDuracionesCortas };
