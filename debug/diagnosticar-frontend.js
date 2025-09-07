// Script de diagnóstico completo para el frontend de empleados
// Copiar y pegar en la consola del navegador en /dashboard/empleados

console.log('🔍 DIAGNÓSTICO COMPLETO: Frontend de Empleados');
console.log('===============================================\n');

// Función para buscar componentes React
function findReactComponents() {
    const components = [];
    const allElements = document.querySelectorAll('*');

    for (let el of allElements) {
        const reactKey = Object.keys(el).find(k => k.startsWith('__reactInternalInstance'));
        if (reactKey) {
            const instance = el[reactKey];
            if (instance && instance._debugOwner) {
                const componentName = instance._debugOwner.type?.name || instance._debugOwner.type?.displayName;
                if (componentName && (componentName.toLowerCase().includes('gestion') || componentName.toLowerCase().includes('empleados'))) {
                    components.push({
                        name: componentName,
                        element: el,
                        instance: instance
                    });
                }
            }
        }
    }

    return components;
}

// Función para acceder al estado de un componente React
function getComponentState(component) {
    try {
        const fiber = component.instance._debugOwner;
        if (fiber.memoizedState) {
            return fiber.memoizedState;
        }

        // Intentar acceder al estado de diferentes formas
        if (fiber.stateNode && fiber.stateNode.state) {
            return fiber.stateNode.state;
        }

        return null;
    } catch (e) {
        return null;
    }
}

// Función principal de diagnóstico
async function diagnosticarFrontend() {
    console.log('1️⃣ Verificando contexto de autenticación...');

    // Verificar si estamos en la página correcta
    if (!window.location.pathname.includes('/dashboard/empleados')) {
        console.log('⚠️ No estás en la página /dashboard/empleados');
        console.log('   Página actual:', window.location.pathname);
        console.log('   Ve a: /dashboard/empleados para ejecutar este diagnóstico');
        return;
    }

    // Verificar contexto global
    if (window.authContext) {
        console.log('✅ Contexto de autenticación encontrado');
        console.log('   User ID:', window.authContext.user?.id);
        console.log('   User Email:', window.authContext.user?.email);
        console.log('   estId:', window.authContext.estId);
    } else {
        console.log('❌ No se encontró contexto de autenticación');
    }

    console.log('\n2️⃣ Probando API directamente...');

    const estId = window.authContext?.estId || 4;
    const apiUrl = `/api/empleados?est_id=${estId}`;

    try {
        const response = await fetch(apiUrl);
        console.log('   Status:', response.status);

        if (!response.ok) {
            console.log('   ❌ Error en API:', response.statusText);
            return;
        }

        const data = await response.json();
        console.log('   ✅ Respuesta API OK');
        console.log('   Total empleados:', data.empleados?.length || 0);

        const empleado7 = data.empleados?.find(e => e.usu_id === 30);
        if (empleado7) {
            console.log('   🎯 Empleado 7 encontrado en API:', empleado7);
        } else {
            console.log('   ❌ Empleado 7 NO encontrado en API');
            console.log('   IDs disponibles:', data.empleados?.map(e => e.usu_id));
        }
    } catch (error) {
        console.log('   💥 Error conectando a API:', error.message);
    }

    console.log('\n3️⃣ Buscando componentes React...');

    const components = findReactComponents();
    console.log('   Componentes encontrados:', components.length);

    components.forEach((comp, index) => {
        console.log(`   ${index + 1}. ${comp.name}`);

        const state = getComponentState(comp);
        if (state) {
            console.log('      Estado encontrado');
            console.log('      Empleados en estado:', state.empleados?.length || 'N/A');

            if (state.empleados) {
                const empleado7EnEstado = state.empleados.find(e => e.usu_id === 30);
                if (empleado7EnEstado) {
                    console.log('      🎯 Empleado 7 encontrado en estado');
                } else {
                    console.log('      ❌ Empleado 7 NO encontrado en estado');
                    console.log('      IDs en estado:', state.empleados.map(e => e.usu_id));
                }
            }
        } else {
            console.log('      No se pudo acceder al estado');
        }
    });

    console.log('\n4️⃣ Verificando DOM...');

    // Buscar elementos en el DOM que muestren empleados
    const tableRows = document.querySelectorAll('table tbody tr');
    console.log('   Filas en tabla:', tableRows.length);

    let empleado7EnDOM = false;
    tableRows.forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        if (cells.length > 0) {
            const firstCell = cells[0].textContent;
            console.log(`   Fila ${index + 1}: ${firstCell}`);

            // Buscar si contiene el nombre del empleado 7
            if (firstCell && firstCell.includes('nombre1')) {
                empleado7EnDOM = true;
                console.log('   🎯 Empleado 7 encontrado en DOM');
            }
        }
    });

    if (!empleado7EnDOM) {
        console.log('   ❌ Empleado 7 NO encontrado en DOM');
    }

    console.log('\n5️⃣ Verificando localStorage...');

    const savedEstId = localStorage.getItem('parking_est_id');
    console.log('   estId en localStorage:', savedEstId);

    console.log('\n✨ Diagnóstico completado!');
    console.log('\n📋 Resumen de problemas encontrados:');

    const problemas = [];

    if (!window.authContext?.estId) {
        problemas.push('❌ No hay estId en el contexto de autenticación');
    }

    // El resto del resumen se completará basado en los resultados
    setTimeout(() => {
        console.log('\n🔧 Próximos pasos recomendados:');
        console.log('   1. Si la API funciona pero el componente no: problema de estado React');
        console.log('   2. Si el componente tiene estado pero el DOM no: problema de render');
        console.log('   3. Si todo funciona menos el empleado 7: problema específico de datos');
        console.log('   4. Ejecutar: location.reload() para forzar recarga completa');
    }, 1000);
}

// Ejecutar diagnóstico
diagnosticarFrontend().catch(console.error);
