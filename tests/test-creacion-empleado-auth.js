// Test para verificar que la creación de empleados ahora incluye Supabase Auth
// Ejecutar en el navegador desde /dashboard/empleados

console.log('🔍 TEST: Verificación de creación de empleados con Auth');
console.log('==================================================');

// Función para probar la creación de empleado
async function testCrearEmpleado() {
    const testData = {
        nombre: 'Test',
        apellido: 'Empleado',
        dni: '99999999',
        email: `test${Date.now()}@example.com`, // Email único
        estado: 'Activo',
        contrasena: 'TestPass123!',
        est_id: 4, // Cambiar según tu estacionamiento
        disponibilidad: [
            { dia_semana: 1, turno_id: 1 }, // Lunes - Mañana
            { dia_semana: 2, turno_id: 1 }, // Martes - Mañana
        ]
    };

    console.log('📤 Enviando datos de prueba:', testData);

    try {
        const response = await fetch('/api/empleados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(testData)
        });

        const result = await response.json();

        console.log('📥 Respuesta del servidor:', response.status);
        console.log('📋 Datos de respuesta:', result);

        if (response.ok) {
            console.log('✅ Empleado creado exitosamente!');
            console.log('🆔 ID de usuario en Auth:', result.auth_user_id);
            console.log('👤 Datos del empleado:', result.empleado);

            // Verificar que el usuario puede hacer login
            await testLoginEmpleado(testData.email, testData.contrasena);
        } else {
            console.error('❌ Error al crear empleado:', result.error);
        }

    } catch (error) {
        console.error('💥 Error de conexión:', error);
    }
}

// Función para probar login del empleado creado
async function testLoginEmpleado(email, password) {
    console.log('🔐 Probando login del empleado creado...');

    try {
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

        const supabase = createClient(
            window.location.origin.replace(':3000', ':3001') + '/api/supabase',
            'tu-anon-key-aqui' // Reemplazar con tu anon key
        );

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('❌ Error en login:', error.message);
        } else {
            console.log('✅ Login exitoso! El empleado puede acceder al sistema.');
            console.log('👤 Usuario logueado:', data.user.email);

            // Logout para limpiar
            await supabase.auth.signOut();
        }

    } catch (error) {
        console.error('💥 Error en prueba de login:', error);
    }
}

// Función para verificar empleados existentes
async function verificarEmpleadosExistentes() {
    console.log('📊 Verificando empleados existentes...');

    try {
        const response = await fetch('/api/empleados?est_id=4'); // Cambiar est_id según tu caso
        const result = await response.json();

        console.log('👥 Empleados encontrados:', result.empleados?.length || 0);
        if (result.empleados) {
            result.empleados.forEach((emp, index) => {
                console.log(`${index + 1}. ${emp.nombre} ${emp.apellido} (${emp.email})`);
                console.log(`   Estado: ${emp.estado}`);
                console.log(`   Turnos: ${emp.disponibilidad.length}`);
            });
        }

    } catch (error) {
        console.error('💥 Error al obtener empleados:', error);
    }
}

// Ejecutar pruebas
console.log('🚀 Iniciando pruebas...');
console.log('');

console.log('1️⃣ Verificando empleados existentes antes de la prueba:');
await verificarEmpleadosExistentes();
console.log('');

console.log('2️⃣ Creando nuevo empleado con Auth:');
await testCrearEmpleado();
console.log('');

console.log('3️⃣ Verificando empleados después de crear:');
await verificarEmpleadosExistentes();
console.log('');

console.log('✨ Pruebas completadas. Revisa los logs para verificar el funcionamiento.');
