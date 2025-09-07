// Script para probar el dashboard/empleados y verificar el flujo de datos
// Ejecutar desde la consola del navegador en /dashboard/empleados

console.log('🔍 TEST: Dashboard Empleados - Verificación de flujo de datos');
console.log('=============================================================');

// 1. Verificar contexto de autenticación
function verificarAuthContext() {
    console.log('1️⃣ Verificando contexto de autenticación...');

    // Simular la lógica del componente
    if (window.authContext) {
        console.log('📋 Contexto de auth encontrado:', {
            user: window.authContext.user?.email || 'No user',
            estId: window.authContext.estId || 'No estId',
            loading: window.authContext.loading
        });
    } else {
        console.log('⚠️ No se encontró contexto de auth. Buscando en localStorage...');

        // Buscar en localStorage
        const authData = localStorage.getItem('auth-storage');
        if (authData) {
            try {
                const parsed = JSON.parse(authData);
                console.log('📦 Datos de auth en localStorage:', parsed.state);
            } catch (e) {
                console.log('❌ Error parseando localStorage:', e);
            }
        } else {
            console.log('❌ No hay datos de auth en localStorage');
        }
    }
}

// 2. Probar obtener empleados directamente
async function probarObtenerEmpleados(estId) {
    console.log('2️⃣ Probando obtener empleados...');

    try {
        const url = estId ? `/api/empleados?est_id=${estId}` : '/api/empleados';
        console.log('🔗 URL de la petición:', url);

        const response = await fetch(url);
        console.log('📡 Respuesta HTTP:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
        });

        const result = await response.json();
        console.log('📋 Datos de respuesta:', result);

        if (result.empleados) {
            console.log('✅ Empleados encontrados:', result.empleados.length);
            result.empleados.forEach((emp, index) => {
                console.log(`   ${index + 1}. ${emp.nombre} ${emp.apellido} (${emp.email})`);
                console.log(`      Estado: ${emp.estado}`);
                console.log(`      Estacionamiento: ${emp.estacionamiento?.est_nombre || 'N/A'}`);
                console.log(`      Turnos: ${emp.disponibilidad?.length || 0}`);
            });
        } else {
            console.log('⚠️ No se encontraron empleados o hay un error');
        }

    } catch (error) {
        console.log('❌ Error en la petición:', error);
    }
}

// 3. Verificar empleados_estacionamiento directamente
async function verificarEmpleadosEstacionamiento(estId) {
    console.log('3️⃣ Verificando tabla empleados_estacionamiento...');

    try {
        const response = await fetch('/api/empleados/estacionamientos');
        const result = await response.json();

        console.log('📋 Estacionamientos disponibles:', result);

        if (estId) {
            console.log('🔍 Buscando empleados para est_id:', estId);

            // Verificar empleados para este estacionamiento específico
            const empleadosResponse = await fetch(`/api/empleados?est_id=${estId}`);
            const empleadosResult = await empleadosResponse.json();

            console.log('👥 Empleados para este estacionamiento:', empleadosResult);
        }

    } catch (error) {
        console.log('❌ Error verificando empleados_estacionamiento:', error);
    }
}

// 4. Verificar estructura de la base de datos
async function verificarEstructuraBD() {
    console.log('4️⃣ Verificando estructura de la base de datos...');

    // Aquí podríamos hacer consultas directas si tuviéramos acceso
    console.log('ℹ️ Para verificar la estructura completa, ejecuta en Supabase SQL:');

    console.log(`
-- Ver empleados asignados a estacionamientos
SELECT
    ee.play_id,
    ee.est_id,
    ee.fecha_asignacion,
    ee.activo,
    u.usu_nom,
    u.usu_ape,
    u.usu_email,
    u.usu_estado,
    e.est_nombre
FROM empleados_estacionamiento ee
JOIN playeros p ON ee.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN estacionamientos e ON ee.est_id = e.est_id
WHERE ee.activo = true
ORDER BY ee.fecha_asignacion DESC;

-- Ver todos los empleados
SELECT
    u.usu_id,
    u.usu_nom,
    u.usu_ape,
    u.usu_email,
    u.usu_estado,
    p.play_id,
    'Empleado' as tipo
FROM usuario u
JOIN playeros p ON u.usu_id = p.play_id;

-- Ver asignaciones activas
SELECT
    ee.*,
    u.usu_nom,
    u.usu_ape,
    e.est_nombre
FROM empleados_estacionamiento ee
JOIN playeros p ON ee.play_id = p.play_id
JOIN usuario u ON p.play_id = u.usu_id
JOIN estacionamientos e ON ee.est_id = e.est_id
WHERE ee.activo = true;
    `);
}

// Función principal para ejecutar todas las pruebas
async function ejecutarPruebas() {
    console.log('🚀 Iniciando pruebas del dashboard empleados...\n');

    // Extraer estId de la URL o del contexto
    const urlParams = new URLSearchParams(window.location.search);
    const estIdFromUrl = urlParams.get('est_id');

    // Intentar obtener estId del contexto de auth (simular useAuth)
    let estId = estIdFromUrl;

    if (!estId && window.authContext?.estId) {
        estId = window.authContext.estId;
    }

    if (!estId) {
        console.log('⚠️ No se pudo determinar estId automáticamente');
        console.log('💡 Puedes especificar manualmente: ejecutarPruebas(4) // reemplaza 4 con tu est_id');
        estId = prompt('Ingresa el est_id del estacionamiento actual:');
    }

    console.log('🎯 Usando estId:', estId, '\n');

    await verificarAuthContext();
    console.log('');

    await probarObtenerEmpleados(estId);
    console.log('');

    await verificarEmpleadosEstacionamiento(estId);
    console.log('');

    await verificarEstructuraBD();
    console.log('');

    console.log('✨ Pruebas completadas!');
    console.log('💡 Si no ves empleados, revisa:');
    console.log('   1. Que el estId sea correcto');
    console.log('   2. Que haya empleados asignados a ese estacionamiento');
    console.log('   3. Que las asignaciones estén activas (activo = true)');
}

// Hacer que las funciones estén disponibles globalmente
window.verificarAuthContext = verificarAuthContext;
window.probarObtenerEmpleados = probarObtenerEmpleados;
window.verificarEmpleadosEstacionamiento = verificarEmpleadosEstacionamiento;
window.verificarEstructuraBD = verificarEstructuraBD;
window.ejecutarPruebas = ejecutarPruebas;

// Ejecutar automáticamente
ejecutarPruebas();
