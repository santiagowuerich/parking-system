// Script de diagnóstico para el frontend de empleados
// Ejecutar en la consola del navegador en /dashboard/empleados

console.log('🔍 DIAGNÓSTICO: Frontend de Empleados');
console.log('====================================\n');

// Verificar contexto de autenticación
console.log('1️⃣ Verificando contexto de autenticación...');
const authContext = window.__NEXT_DATA__?.props?.pageProps?.authContext;
console.log('   Contexto de auth:', authContext);

if (typeof window !== 'undefined' && window.authContext) {
    console.log('   estId del contexto:', window.authContext.estId);
} else {
    console.log('   ⚠️ No se encontró contexto de autenticación');
}

// Función para probar la carga de empleados
async function testLoadEmpleados() {
    console.log('\n2️⃣ Probando carga de empleados...');

    const estId = 4; // Usar el estacionamiento que sabemos que funciona
    const url = `/api/empleados?est_id=${estId}`;

    console.log('   URL a consultar:', url);

    try {
        const response = await fetch(url);
        console.log('   Status de respuesta:', response.status);

        if (!response.ok) {
            console.log('   ❌ Error en respuesta:', response.statusText);
            return;
        }

        const data = await response.json();
        console.log('   📊 Datos recibidos:', data);

        if (data.empleados) {
            console.log('   ✅ Empleados encontrados:', data.empleados.length);

            // Buscar específicamente el empleado 7
            const empleado7 = data.empleados.find(emp => emp.usu_id === 30);
            if (empleado7) {
                console.log('   🎯 Empleado 7 encontrado:', empleado7);
            } else {
                console.log('   ❌ Empleado 7 NO encontrado en la respuesta');
                console.log('   👥 Lista completa de empleados:', data.empleados.map(e => ({ id: e.usu_id, nombre: e.nombre })));
            }
        } else {
            console.log('   ⚠️ No se encontró array de empleados en la respuesta');
        }

    } catch (error) {
        console.log('   💥 Error en la petición:', error.message);
    }
}

// Función para verificar la función loadEmpleados del componente
function testComponentLoadEmpleados() {
    console.log('\n3️⃣ Verificando función loadEmpleados del componente...');

    // Buscar el componente React
    const reactInstances = Object.keys(window)
        .filter(key => key.startsWith('__reactInternalInstance'))
        .map(key => window[key]);

    console.log('   Instancias React encontradas:', reactInstances.length);

    // Buscar componentes relacionados con empleados
    reactInstances.forEach((instance, index) => {
        if (instance && instance._debugOwner) {
            const componentName = instance._debugOwner.type?.name || instance._debugOwner.type?.displayName;
            if (componentName && componentName.toLowerCase().includes('gestion')) {
                console.log(`   📋 Componente encontrado [${index}]:`, componentName);

                // Intentar acceder a las props del componente
                if (instance._debugOwner.memoizedProps) {
                    const props = instance._debugOwner.memoizedProps;
                    console.log('      Props del componente:', Object.keys(props));

                    // Buscar estado relacionado con empleados
                    if (props.children && Array.isArray(props.children)) {
                        props.children.forEach((child, childIndex) => {
                            if (child && typeof child === 'object' && child.props) {
                                const childProps = child.props;
                                if (childProps.empleados) {
                                    console.log(`      👥 Estado de empleados [${childIndex}]:`, childProps.empleados.length, 'empleados');

                                    const empleado7 = childProps.empleados.find(emp => emp.usu_id === 30);
                                    if (empleado7) {
                                        console.log('      🎯 Empleado 7 en estado del componente:', empleado7);
                                    } else {
                                        console.log('      ❌ Empleado 7 NO encontrado en estado del componente');
                                    }
                                }
                            }
                        });
                    }
                }
            }
        }
    });
}

// Ejecutar pruebas
console.log('\n🚀 Ejecutando pruebas...\n');

// Ejecutar la prueba de API
testLoadEmpleados();

// Ejecutar la prueba del componente después de un pequeño delay
setTimeout(() => {
    testComponentLoadEmpleados();

    console.log('\n✨ Diagnóstico completado!');
    console.log('\n📋 Próximos pasos:');
    console.log('   1. Si la API funciona pero el componente no: problema en el estado de React');
    console.log('   2. Si la API no funciona: problema en el endpoint');
    console.log('   3. Si todo funciona: problema en la sincronización de estado');
}, 1000);
