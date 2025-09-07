// Script para consultar empleados a través de la API existente
// Esto nos permitirá verificar si los empleados están siendo creados correctamente

console.log('🔍 Consultando empleados a través de la API...\n');

// Función para hacer consultas HTTP
async function makeRequest(url, options = {}) {
    try {
        console.log(`📡 ${options.method || 'GET'} ${url}`);
        const response = await fetch(url, options);
        console.log(`📥 Status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`❌ Error en petición: ${error.message}`);
        return null;
    }
}

// 1. Consultar empleados sin filtro
async function consultarEmpleadosGenerales() {
    console.log('1️⃣ Consultando empleados generales...');
    const data = await makeRequest('/api/empleados');

    if (data) {
        console.log('✅ Respuesta:', data);
        console.log(`👥 Total de empleados encontrados: ${data.empleados?.length || 0}`);

        if (data.empleados && data.empleados.length > 0) {
            console.log('📋 Lista de empleados:');
            data.empleados.forEach((emp, index) => {
                console.log(`   ${index + 1}. ${emp.nombre} ${emp.apellido}`);
                console.log(`      📧 Email: ${emp.email}`);
                console.log(`      📊 Estado: ${emp.estado}`);
                console.log(`      🏢 Estacionamiento: ${emp.estacionamiento?.est_nombre || 'N/A'}`);
                console.log(`      📅 Disponibilidad: ${emp.disponibilidad?.length || 0} turnos`);
                console.log('');
            });
        }
    }
}

// 2. Consultar empleados por estacionamiento específico
async function consultarEmpleadosPorEstacionamiento(estId) {
    console.log(`2️⃣ Consultando empleados para estacionamiento ${estId}...`);
    const data = await makeRequest(`/api/empleados?est_id=${estId}`);

    if (data) {
        console.log('✅ Respuesta:', data);
        console.log(`👥 Empleados en estacionamiento ${estId}: ${data.empleados?.length || 0}`);

        if (data.empleados && data.empleados.length > 0) {
            data.empleados.forEach((emp, index) => {
                console.log(`   ${index + 1}. ${emp.nombre} ${emp.apellido} (${emp.email})`);
            });
        } else {
            console.log('⚠️ No hay empleados asignados a este estacionamiento');
        }
    }
}

// 3. Consultar estacionamientos disponibles
async function consultarEstacionamientos() {
    console.log('3️⃣ Consultando estacionamientos disponibles...');
    const data = await makeRequest('/api/empleados/estacionamientos');

    if (data) {
        console.log('✅ Estacionamientos encontrados:', data.length);
        data.forEach((est, index) => {
            console.log(`   ${index + 1}. ID: ${est.est_id} - ${est.est_nombre} (${est.est_locali})`);
        });

        return data; // Retornar para usar en otras consultas
    }

    return [];
}

// 4. Consultar turnos disponibles
async function consultarTurnos() {
    console.log('4️⃣ Consultando turnos disponibles...');
    const data = await makeRequest('/api/empleados/turnos');

    if (data) {
        console.log('✅ Turnos encontrados:', data.length);
        data.forEach((turno, index) => {
            console.log(`   ${index + 1}. ${turno.nombre_turno} (ID: ${turno.turno_id})`);
        });
    }
}

// Función principal
async function ejecutarConsultas() {
    console.log('🚀 Iniciando consultas a la API de empleados...\n');

    // Ejecutar consultas en secuencia
    await consultarTurnos();
    console.log('');

    const estacionamientos = await consultarEstacionamientos();
    console.log('');

    await consultarEmpleadosGenerales();
    console.log('');

    // Si hay estacionamientos, consultar empleados para el primero
    if (estacionamientos.length > 0) {
        const primerEstId = estacionamientos[0].est_id;
        console.log(`🎯 Consultando empleados para el primer estacionamiento (ID: ${primerEstId})...`);
        await consultarEmpleadosPorEstacionamiento(primerEstId);
    }

    console.log('\n✨ Consultas completadas!');
    console.log('\n💡 Si no ves empleados, posibles causas:');
    console.log('   1. No hay empleados creados en el sistema');
    console.log('   2. Los empleados no están asignados a estacionamientos');
    console.log('   3. Hay un problema con la autenticación');
    console.log('   4. Error en las consultas de la base de datos');
}

// Hacer que las funciones estén disponibles globalmente
window.consultarEmpleadosGenerales = consultarEmpleadosGenerales;
window.consultarEmpleadosPorEstacionamiento = consultarEmpleadosPorEstacionamiento;
window.consultarEstacionamientos = consultarEstacionamientos;
window.consultarTurnos = consultarTurnos;
window.ejecutarConsultas = ejecutarConsultas;

// Ejecutar automáticamente si estamos en el contexto correcto
if (typeof window !== 'undefined' && window.location) {
    // Solo ejecutar si estamos en el navegador y en una página del proyecto
    const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    if (isLocalhost) {
        ejecutarConsultas();
    } else {
        console.log('ℹ️ Ejecuta ejecutarConsultas() manualmente cuando estés en localhost');
    }
}

console.log('📋 Funciones disponibles:');
console.log('   - ejecutarConsultas() - Ejecuta todas las consultas');
console.log('   - consultarEmpleadosGenerales() - Empleados sin filtro');
console.log('   - consultarEmpleadosPorEstacionamiento(id) - Empleados por estacionamiento');
console.log('   - consultarEstacionamientos() - Lista de estacionamientos');
console.log('   - consultarTurnos() - Lista de turnos disponibles');
