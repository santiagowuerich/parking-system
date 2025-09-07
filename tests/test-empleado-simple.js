// Test simple para verificar el flujo de creación de empleados
// Ejecutar con: node test-empleado-simple.js

const fetch = require('node-fetch');

async function testEmpleadoFlow() {
    console.log('🧪 Verificando flujo de creación de empleados...\n');

    try {
        // 1. Verificar turnos disponibles
        console.log('1️⃣ Verificando turnos disponibles...');
        const turnosResponse = await fetch('http://localhost:3000/api/empleados/turnos');

        if (!turnosResponse.ok) {
            console.log('❌ Error al obtener turnos:', turnosResponse.status);
            return;
        }

        const turnosData = await turnosResponse.json();
        console.log('✅ Turnos obtenidos:', turnosData);

        // 2. Verificar empleados existentes
        console.log('\n2️⃣ Verificando empleados existentes...');
        const empleadosResponse = await fetch('http://localhost:3000/api/empleados?est_id=4'); // Usando est_id=4 como ejemplo

        if (!empleadosResponse.ok) {
            console.log('❌ Error al obtener empleados:', empleadosResponse.status);
            const errorText = await empleadosResponse.text();
            console.log('Respuesta de error:', errorText);
            return;
        }

        const empleadosData = await empleadosResponse.json();
        console.log('✅ Empleados obtenidos:', empleadosData);

        console.log('\n🎯 Verificación completada exitosamente');

    } catch (error) {
        console.log('❌ Error en la verificación:', error.message);
    }
}

// Ejecutar la prueba
testEmpleadoFlow();
