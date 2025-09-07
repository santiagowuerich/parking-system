// test-api-empleados.js
// Script para probar la API de empleados

const API_BASE = 'http://localhost:3000';

async function testEmpleadosAPI() {
    console.log('🧪 Probando API de Empleados...\n');

    try {
        // 1. Probar GET - Obtener empleados
        console.log('1️⃣ Probando GET /api/empleados');
        const getResponse = await fetch(`${API_BASE}/api/empleados?est_id=1`);
        const getData = await getResponse.json();

        if (getResponse.ok) {
            console.log('✅ GET exitoso:', getData.empleados?.length || 0, 'empleados encontrados');
            if (getData.empleados?.length > 0) {
                console.log('📋 Primer empleado:', {
                    nombre: getData.empleados[0].nombre,
                    email: getData.empleados[0].email,
                    estado: getData.empleados[0].estado
                });
            }
        } else {
            console.log('❌ Error en GET:', getData.error);
        }

        console.log('');

        // 2. Probar GET turnos
        console.log('2️⃣ Probando GET /api/empleados/turnos');
        const turnosResponse = await fetch(`${API_BASE}/api/empleados/turnos`);
        const turnosData = await turnosResponse.json();

        if (turnosResponse.ok) {
            console.log('✅ Turnos obtenidos:', turnosData.turnos?.map(t => t.nombre_turno).join(', '));
        } else {
            console.log('❌ Error obteniendo turnos:', turnosData.error);
        }

        console.log('');

        // 3. Probar POST - Crear empleado (solo si queremos probar)
        const crearEmpleado = false; // Cambiar a true para probar creación
        if (crearEmpleado) {
            console.log('3️⃣ Probando POST /api/empleados');
            const nuevoEmpleado = {
                nombre: 'María',
                apellido: 'González',
                dni: '87654321',
                email: 'maria.gonzalez@example.com',
                contrasena: 'password123',
                estado: 'Activo',
                est_id: 1,
                disponibilidad: [
                    { dia_semana: 1, turno_id: 1 }, // Lunes - Mañana
                    { dia_semana: 3, turno_id: 2 }  // Miércoles - Tarde
                ]
            };

            const postResponse = await fetch(`${API_BASE}/api/empleados`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nuevoEmpleado)
            });

            const postData = await postResponse.json();

            if (postResponse.ok) {
                console.log('✅ Empleado creado:', postData.empleado);
            } else {
                console.log('❌ Error creando empleado:', postData.error);
            }
        }

        console.log('\n🎉 Pruebas completadas!');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
    }
}

// Ejecutar pruebas
testEmpleadosAPI();
