// Script de debug para probar creación de empleados
// Ejecutar en consola del navegador desde /dashboard/empleados

console.log('🔧 Debug de creación de empleados iniciado');

// Verificar estado de autenticación
const authState = window.authContext || {};
console.log('🔐 Estado de autenticación:', {
    user: authState.user,
    estId: authState.estId,
    isAuthenticated: !!authState.user
});

// Verificar que las funciones estén disponibles
console.log('📦 Funciones disponibles:', {
    crearEmpleado: typeof window.crearEmpleado === 'function',
    fetch: typeof fetch === 'function'
});

// Función de prueba
window.testCrearEmpleado = async function () {
    console.log('🧪 Iniciando prueba de creación...');

    const testData = {
        nombre: 'Test',
        apellido: 'User',
        dni: '12345678',
        email: 'test-' + Date.now() + '@example.com',
        contrasena: 'password123',
        estado: 'Activo',
        est_id: authState.estId || 1,
        disponibilidad: [
            { dia_semana: 1, turno_id: 1 },
            { dia_semana: 2, turno_id: 2 }
        ]
    };

    console.log('📤 Datos de prueba:', testData);

    try {
        const response = await fetch('/api/empleados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData),
        });

        console.log('📊 Respuesta HTTP:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        const result = await response.json();
        console.log('📋 Resultado:', result);

        if (response.ok) {
            console.log('✅ Empleado creado exitosamente');
        } else {
            console.log('❌ Error al crear empleado:', result.error);
        }

    } catch (error) {
        console.log('❌ Error de conexión:', error);
    }
};

console.log('💡 Ejecuta: testCrearEmpleado() para probar la creación');
console.log('🔧 Debug listo - revisa la consola del navegador');
