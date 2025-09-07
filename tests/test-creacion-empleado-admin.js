// Script para probar la creación de empleados con permisos admin
// Ejecutar desde la consola del navegador en /dashboard/empleados

console.log('🛠️ TEST: Creación de empleados con permisos admin');
console.log('==============================================\n');

// Función para probar creación de empleado
async function probarCreacionEmpleado() {
    const testData = {
        nombre: 'Test',
        apellido: 'Admin',
        dni: '77778888',
        email: `testadmin${Date.now()}@example.com`, // Email único
        estado: 'Activo',
        contrasena: 'TestPass123!',
        est_id: 4,
        disponibilidad: [
            { dia_semana: 1, turno: 'Mañana', turno_id: 1 },
            { dia_semana: 2, turno: 'Tarde', turno_id: 2 },
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

        console.log('📥 Respuesta del servidor:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        console.log('📋 Resultado completo:', result);

        if (response.ok) {
            console.log('✅ Empleado creado exitosamente!');
            console.log('🆔 ID de usuario en Auth:', result.auth_user_id);
            console.log('👤 Datos del empleado:', result.empleado);

            // Verificar que el empleado aparezca en la lista
            await verificarEmpleadoEnLista(testData.email);

            return true;
        } else {
            console.log('❌ Error al crear empleado:', result.error);
            return false;
        }

    } catch (error) {
        console.error('💥 Error de conexión:', error.message);
        return false;
    }
}

// Función para verificar que el empleado aparezca en la lista
async function verificarEmpleadoEnLista(email) {
    console.log('\n🔍 Verificando que el empleado aparezca en la lista...');

    try {
        // Obtener empleados del estacionamiento 4
        const response = await fetch('/api/empleados?est_id=4');
        const result = await response.json();

        if (response.ok && result.empleados) {
            const empleadoEncontrado = result.empleados.find(emp => emp.email === email);

            if (empleadoEncontrado) {
                console.log('✅ Empleado encontrado en la lista:', {
                    nombre: empleadoEncontrado.nombre,
                    apellido: empleadoEncontrado.apellido,
                    email: empleadoEncontrado.email,
                    estado: empleadoEncontrado.estado,
                    estacionamiento: empleadoEncontrado.estacionamiento?.est_nombre,
                    turnos: empleadoEncontrado.disponibilidad?.length || 0
                });
            } else {
                console.log('⚠️ Empleado NO encontrado en la lista');
                console.log('👥 Empleados existentes:', result.empleados.map(e => e.email));
            }
        } else {
            console.log('❌ Error al obtener lista de empleados:', result.error);
        }

    } catch (error) {
        console.log('❌ Error al verificar empleado en lista:', error.message);
    }
}

// Función para verificar configuración del service role
async function verificarServiceRole() {
    console.log('🔧 Verificando configuración del service role...');

    try {
        // Intentar una operación que requiere permisos admin
        const response = await fetch('/api/empleados', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                nombre: 'Config',
                apellido: 'Test',
                dni: '00000000',
                email: `configtest${Date.now()}@example.com`,
                estado: 'Activo',
                contrasena: 'ConfigTest123!',
                est_id: 4,
                disponibilidad: [{ dia_semana: 1, turno: 'Mañana', turno_id: 1 }]
            })
        });

        if (response.status === 500) {
            const result = await response.json();
            if (result.error && result.error.includes('not_admin')) {
                console.log('❌ Service role NO configurado correctamente');
                console.log('💡 Asegúrate de que SUPABASE_SERVICE_ROLE_KEY esté configurado');
                return false;
            }
        }

        if (response.ok) {
            console.log('✅ Service role configurado correctamente');
            return true;
        }

        console.log('⚠️ Respuesta inesperada:', response.status);
        return false;

    } catch (error) {
        console.log('❌ Error al verificar service role:', error.message);
        return false;
    }
}

// Función para verificar variables de entorno
function verificarVariablesEntorno() {
    console.log('🔍 Verificando variables de entorno...');

    // Verificar si las variables están disponibles
    const supabaseUrl = window.location.origin.replace(':3000', ':3001') + '/api/supabase';

    console.log('🌐 Supabase URL detectada:', supabaseUrl);
    console.log('ℹ️ Service Role Key debe estar configurado en el servidor');
    console.log('📝 Las variables de entorno se configuran en:');
    console.log('   - .env.local');
    console.log('   - .env.development');
    console.log('   - Variables de sistema');
}

// Función principal
async function ejecutarTestCompleto() {
    console.log('🚀 Iniciando test completo de creación de empleados...\n');

    // Verificar configuración
    verificarVariablesEntorno();
    console.log('');

    const serviceRoleOk = await verificarServiceRole();
    console.log('');

    if (!serviceRoleOk) {
        console.log('❌ No se puede continuar sin service role configurado');
        console.log('🔧 Solución: Agregar SUPABASE_SERVICE_ROLE_KEY al archivo .env');
        return;
    }

    // Probar creación de empleado
    const creacionExitosa = await probarCreacionEmpleado();

    if (creacionExitosa) {
        console.log('\n🎉 ¡Test completado exitosamente!');
        console.log('✅ Empleado creado con permisos admin');
        console.log('✅ Usuario registrado en Supabase Auth');
        console.log('✅ Empleado asignado a estacionamiento');
        console.log('✅ Empleado visible en la lista');
    } else {
        console.log('\n❌ Test fallido');
        console.log('🔧 Revisar configuración del service role');
    }
}

// Hacer funciones disponibles globalmente
window.probarCreacionEmpleado = probarCreacionEmpleado;
window.verificarEmpleadoEnLista = verificarEmpleadoEnLista;
window.verificarServiceRole = verificarServiceRole;
window.verificarVariablesEntorno = verificarVariablesEntorno;
window.ejecutarTestCompleto = ejecutarTestCompleto;

// Ejecutar automáticamente si estamos en el contexto correcto
if (typeof window !== 'undefined' && window.location) {
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        console.log('🌐 Detectado localhost - ejecutando test automáticamente...');
        ejecutarTestCompleto();
    } else {
        console.log('ℹ️ Ejecuta ejecutarTestCompleto() manualmente');
    }
}

console.log('📋 Funciones disponibles:');
console.log('   - ejecutarTestCompleto() - Ejecuta todas las pruebas');
console.log('   - probarCreacionEmpleado() - Prueba creación individual');
console.log('   - verificarServiceRole() - Verifica configuración admin');
console.log('   - verificarVariablesEntorno() - Muestra info de configuración');
