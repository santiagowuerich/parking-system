// test-gestion-empleados.js
// Script para probar la página de gestión de empleados

const API_BASE = 'http://localhost:3000';

async function testGestionEmpleados() {
    console.log('🧪 Probando Gestión de Empleados...\n');

    try {
        // 1. Probar obtener empleados
        console.log('1️⃣ Probando obtener empleados...');
        const empleadosResponse = await fetch(`${API_BASE}/api/empleados?est_id=1`);
        const empleadosData = await empleadosResponse.json();

        if (empleadosResponse.ok) {
            console.log('✅ Empleados obtenidos:', empleadosData.empleados?.length || 0);
            if (empleadosData.empleados?.length > 0) {
                console.log('📋 Empleado de ejemplo:', {
                    nombre: empleadosData.empleados[0].nombre,
                    email: empleadosData.empleados[0].email,
                    estado: empleadosData.empleados[0].estado,
                    disponibilidadCount: empleadosData.empleados[0].disponibilidad?.length || 0
                });
            }
        } else {
            console.log('❌ Error obteniendo empleados:', empleadosData.error);
        }

        console.log('');

        // 2. Probar obtener turnos
        console.log('2️⃣ Probando obtener turnos...');
        const turnosResponse = await fetch(`${API_BASE}/api/empleados/turnos`);
        const turnosData = await turnosResponse.json();

        if (turnosResponse.ok) {
            console.log('✅ Turnos obtenidos:', turnosData.turnos?.map(t => t.nombre_turno).join(', '));
        } else {
            console.log('❌ Error obteniendo turnos:', turnosData.error);
        }

        console.log('\n🎉 Página de gestión de empleados lista para usar!');
        console.log('📍 Accede en: http://localhost:3000/gestion-usuarios');
        console.log('📍 O desde el dashboard: http://localhost:3000/dashboard/empleados');

    } catch (error) {
        console.error('❌ Error en las pruebas:', error.message);
    }
}

// Ejecutar pruebas
testGestionEmpleados();
