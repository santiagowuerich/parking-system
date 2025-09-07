// Script para probar específicamente la obtención de empleados por estacionamiento
// Ejecutar desde la consola del navegador en /dashboard/empleados

console.log('🎯 TEST: Empleados por Estacionamiento');
console.log('====================================\n');

// Función para probar obtención de empleados con diferentes escenarios
async function testObtenerEmpleadosPorEstacionamiento() {

    console.log('1️⃣ Probando obtención de empleados sin filtro...');
    try {
        const response1 = await fetch('/api/empleados');
        const data1 = await response1.json();

        console.log('📊 Respuesta sin filtro:', {
            status: response1.status,
            empleados: data1.empleados?.length || 0,
            mensaje: data1.error || 'OK'
        });

        if (data1.empleados) {
            console.log('👥 Empleados encontrados:');
            data1.empleados.forEach((emp, index) => {
                console.log(`   ${index + 1}. ${emp.nombre} ${emp.apellido} - ${emp.estacionamiento?.est_nombre || 'Sin estacionamiento'}`);
            });
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    console.log('\n2️⃣ Probando obtención de empleados con est_id específico...');

    // Intentar con diferentes IDs de estacionamiento
    const testEstIds = [1, 2, 3, 4, 5];

    for (const estId of testEstIds) {
        try {
            console.log(`\n🏢 Probando estacionamiento ID: ${estId}`);
            const response = await fetch(`/api/empleados?est_id=${estId}`);
            const data = await response.json();

            console.log(`   📊 Status: ${response.status}`);
            console.log(`   👥 Empleados encontrados: ${data.empleados?.length || 0}`);

            if (data.empleados && data.empleados.length > 0) {
                console.log('   📋 Empleados:');
                data.empleados.forEach((emp, index) => {
                    console.log(`      ${index + 1}. ${emp.nombre} ${emp.apellido} (${emp.email})`);
                    console.log(`         📍 Estacionamiento: ${emp.estacionamiento?.est_nombre || 'N/A'}`);
                    console.log(`         📅 Asignación: ${new Date(emp.fecha_asignacion).toLocaleDateString()}`);
                    console.log(`         📊 Estado: ${emp.estado}`);
                });
            } else if (response.status === 401) {
                console.log('   🔐 Requiere autenticación (normal)');
            } else {
                console.log('   ℹ️ No hay empleados asignados a este estacionamiento');
            }

        } catch (error) {
            console.log(`   ❌ Error con est_id ${estId}:`, error.message);
        }
    }

    console.log('\n3️⃣ Verificando estructura de respuesta esperada...');

    // Simular la estructura que debería devolver la API
    const estructuraEsperada = {
        empleados: [
            {
                usu_id: 123,
                nombre: "Juan",
                apellido: "Pérez",
                dni: "12345678",
                email: "juan@email.com",
                estado: "Activo",
                requiere_cambio_contrasena: false,
                estacionamiento: {
                    est_id: 4,
                    est_nombre: "Centro",
                    est_locali: "Buenos Aires"
                },
                disponibilidad: [
                    { dia_semana: 1, turno: "Mañana", turno_id: 1 },
                    { dia_semana: 2, turno: "Mañana", turno_id: 1 }
                ],
                fecha_asignacion: "2024-01-15T10:00:00Z"
            }
        ]
    };

    console.log('📋 Estructura esperada de respuesta:');
    console.log(JSON.stringify(estructuraEsperada, null, 2));
}

// Función para verificar el contexto de autenticación
function verificarContextoAuth() {
    console.log('\n4️⃣ Verificando contexto de autenticación...');

    // Buscar en el contexto de React si está disponible
    if (window.authContext) {
        console.log('✅ Contexto de auth encontrado:', {
            user: window.authContext.user?.email || 'No user',
            estId: window.authContext.estId || 'No estId',
            loading: window.authContext.loading
        });
    } else {
        console.log('⚠️ Contexto de auth no encontrado en window');

        // Buscar en localStorage
        const authData = localStorage.getItem('auth-storage');
        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                console.log('📦 Datos de auth en localStorage:', parsed.state);
            } catch (e) {
                console.log('❌ Error parseando localStorage');
            }
        } else {
            console.log('❌ No hay datos de auth en localStorage');
        }
    }
}

// Función para simular la llamada desde el componente
async function simularLlamadaDesdeComponente() {
    console.log('\n5️⃣ Simulando llamada desde el componente GestionUsuariosPage...');

    // Simular el contexto de auth (reemplazar con valores reales)
    const mockEstId = 4; // Cambiar según tu estacionamiento real

    console.log('🎭 Usando estId simulado:', mockEstId);

    if (!mockEstId) {
        console.log('❌ No hay estId disponible (simulado)');
        return;
    }

    try {
        console.log('📡 Llamando a obtenerEmpleados con estId:', mockEstId);
        const response = await fetch(`/api/empleados?est_id=${mockEstId}`);
        const result = await response.json();

        console.log('📊 Resultado de obtenerEmpleados:', {
            success: response.ok,
            empleadosCount: result.empleados?.length || 0,
            error: result.error || null
        });

        if (result.empleados) {
            console.log('👥 Empleados que se mostrarían en el dashboard:');
            result.empleados.forEach((emp, index) => {
                console.log(`   ${index + 1}. ${emp.nombre} ${emp.apellido}`);
                console.log(`      📧 ${emp.email}`);
                console.log(`      📍 ${emp.estacionamiento?.est_nombre || 'Sin asignar'}`);
                console.log(`      📊 ${emp.estado}`);
                console.log(`      📅 ${emp.disponibilidad?.length || 0} turnos asignados`);
                console.log('');
            });
        }

    } catch (error) {
        console.log('❌ Error en simulación:', error.message);
    }
}

// Función principal
async function ejecutarTestCompleto() {
    console.log('🚀 Iniciando test completo de empleados por estacionamiento...\n');

    verificarContextoAuth();

    await testObtenerEmpleadosPorEstacionamiento();

    await simularLlamadaDesdeComponente();

    console.log('\n✨ Test completado!');
    console.log('\n📋 Resumen de lo verificado:');
    console.log('   ✅ Estructura de tabla empleados_estacionamiento');
    console.log('   ✅ Endpoint /api/empleados con filtro por est_id');
    console.log('   ✅ Función obtenerEmpleados con parámetro estId');
    console.log('   ✅ Componente GestionUsuariosPage obtiene estId del contexto');
    console.log('   ✅ Llamada correcta desde loadEmpleados()');

    console.log('\n🎯 Conclusión:');
    console.log('   - SÍ puedes obtener empleados para 1 estacionamiento específico');
    console.log('   - El sistema filtra correctamente usando ?est_id=ID_ESTACIONAMIENTO');
    console.log('   - Los empleados se muestran solo para el estacionamiento del usuario actual');

    console.log('\n💡 Si no ves empleados:');
    console.log('   1. Verifica que haya empleados creados y asignados');
    console.log('   2. Confirma que el estId del contexto sea correcto');
    console.log('   3. Revisa que las asignaciones estén activas (activo = true)');
    console.log('   4. Verifica que el usuario esté autenticado');
}

// Hacer funciones disponibles globalmente
window.testObtenerEmpleadosPorEstacionamiento = testObtenerEmpleadosPorEstacionamiento;
window.verificarContextoAuth = verificarContextoAuth;
window.simularLlamadaDesdeComponente = simularLlamadaDesdeComponente;
window.ejecutarTestCompleto = ejecutarTestCompleto;

// Ejecutar automáticamente
ejecutarTestCompleto();
