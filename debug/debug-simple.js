// Script simple para diagnosticar empleados
// Copiar y pegar en la consola del navegador en /dashboard/empleados

console.log('🔍 Diagnóstico de Empleados');
console.log('===========================\n');

// 1. Verificar API directamente
console.log('1️⃣ Probando API...');
fetch('/api/empleados?est_id=4')
    .then(r => r.json())
    .then(data => {
        console.log('📊 Respuesta API:', data);
        const empleados = data.empleados || [];
        console.log('👥 Total empleados:', empleados.length);

        const empleado7 = empleados.find(e => e.usu_id === 30);
        if (empleado7) {
            console.log('✅ Empleado 7 encontrado:', empleado7);
        } else {
            console.log('❌ Empleado 7 NO encontrado');
            console.log('Lista de IDs:', empleados.map(e => e.usu_id));
        }
    })
    .catch(err => console.log('❌ Error API:', err));

// 2. Verificar componente React
console.log('\n2️⃣ Buscando componente...');
setTimeout(() => {
    // Buscar componentes React
    function findReactComponent(name) {
        const all = document.querySelectorAll('*');
        for (let el of all) {
            const key = Object.keys(el).find(k => k.startsWith('__reactInternalInstance'));
            if (key) {
                const comp = el[key];
                if (comp && comp._debugOwner) {
                    const compName = comp._debugOwner.type?.name;
                    if (compName && compName.toLowerCase().includes(name.toLowerCase())) {
                        return comp;
                    }
                }
            }
        }
        return null;
    }

    const gestionComp = findReactComponent('Gestion');
    if (gestionComp) {
        console.log('📋 Componente encontrado');
        // Intentar acceder al estado
        try {
            const fiber = gestionComp._debugOwner;
            if (fiber.memoizedState) {
                console.log('📊 Estado del componente:', fiber.memoizedState);
            }
        } catch (e) {
            console.log('⚠️ No se pudo acceder al estado:', e.message);
        }
    } else {
        console.log('❌ Componente no encontrado');
    }
}, 2000);
