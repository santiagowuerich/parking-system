// Script para probar la visualización de empleados
// Ejecutar en consola del navegador desde /dashboard/empleados

console.log('🔍 Probando visualización de empleados...');

// Función para verificar estado actual
window.verificarEstadoEmpleados = function () {
    console.log('📊 Estado actual del componente:');

    // Verificar estado de React (si está disponible)
    const reactState = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.getFiberRoots?.();
    console.log('🔧 Estado de React:', reactState ? 'Disponible' : 'No disponible');

    // Verificar elementos del DOM
    const tablaEmpleados = document.querySelector('[data-testid="empleados-table"]') ||
        document.querySelector('table') ||
        document.querySelector('.table');
    console.log('📋 Tabla de empleados en DOM:', tablaEmpleados ? 'Encontrada' : 'No encontrada');

    const filasEmpleados = document.querySelectorAll('tbody tr') ||
        document.querySelectorAll('tr');
    console.log('👥 Filas de empleados en DOM:', filasEmpleados.length);

    // Verificar si hay algún empleado en el DOM
    filasEmpleados.forEach((fila, index) => {
        const celdas = fila.querySelectorAll('td');
        if (celdas.length > 0) {
            console.log(`📝 Fila ${index + 1}:`, Array.from(celdas).map(td => td.textContent?.trim()).join(' | '));
        }
    });

    // Verificar mensajes de carga o error
    const loadingElements = document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="Loading"]');
    const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');

    console.log('⏳ Elementos de carga encontrados:', loadingElements.length);
    console.log('❌ Elementos de error encontrados:', errorElements.length);

    return {
        tablaEncontrada: !!tablaEmpleados,
        filasEncontradas: filasEmpleados.length,
        elementosCarga: loadingElements.length,
        elementosError: errorElements.length
    };
};

// Función para probar la carga manual
window.probarCargaEmpleados = async function () {
    console.log('🔄 Probando carga manual de empleados...');

    try {
        // Intentar llamar a la función de carga directamente
        if (window.loadEmpleados && typeof window.loadEmpleados === 'function') {
            console.log('📡 Llamando a loadEmpleados()...');
            await window.loadEmpleados();
            console.log('✅ loadEmpleados() completado');
        } else {
            console.log('❌ Función loadEmpleados no encontrada');

            // Intentar hacer fetch manual
            console.log('🌐 Intentando fetch manual...');
            const response = await fetch('/api/empleados?est_id=4');
            const result = await response.json();
            console.log('📋 Respuesta manual:', result);
        }
    } catch (error) {
        console.log('❌ Error en carga manual:', error);
    }
};

// Función para verificar el contexto de autenticación
window.verificarAuthContext = function () {
    console.log('🔐 Verificando contexto de autenticación...');

    // Buscar posibles contextos
    const contexts = window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.contexts || [];
    console.log('📋 Contextos encontrados:', contexts.length);

    // Verificar variables globales relacionadas con auth
    const authVars = Object.keys(window).filter(key =>
        key.toLowerCase().includes('auth') ||
        key.toLowerCase().includes('user') ||
        key.toLowerCase().includes('est')
    );
    console.log('🔑 Variables relacionadas con auth:', authVars);

    // Verificar localStorage
    const authKeys = Object.keys(localStorage).filter(key =>
        key.includes('auth') ||
        key.includes('user') ||
        key.includes('est')
    );
    console.log('💾 localStorage - Claves de auth:', authKeys);
    authKeys.forEach(key => {
        console.log(`   ${key}:`, localStorage.getItem(key));
    });
};

console.log('💡 Funciones disponibles:');
console.log('   verificarEstadoEmpleados() - Ver estado actual');
console.log('   probarCargaEmpleados() - Probar carga manual');
console.log('   verificarAuthContext() - Ver contexto de autenticación');
console.log('🔧 Ejecuta estas funciones para diagnosticar el problema');
