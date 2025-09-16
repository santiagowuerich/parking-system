/**
 * Script para verificar las rutas disponibles en el dashboard
 */

// Rutas disponibles en el sistema (basado en la estructura de directorios)
const availableRoutes = [
    '/dashboard',
    '/dashboard/tarifas',
    '/dashboard/plantillas',
    '/dashboard/empleados',
    '/dashboard/configuracion-pagos',
    '/dashboard/configuracion-zona',
    '/dashboard/plazas/configuracion-avanzada',
    '/dashboard/visualizacion-plazas',
    '/dashboard/parking',
    '/dashboard/payments',
    '/dashboard/google-maps',
    '/dashboard/panel-administrador',
    '/dashboard/operador-simple'
];

// Acciones definidas en el dashboard
const dashboardActions = [
    { title: "Registrar Entrada", href: "/" },
    { title: "Gestionar Tarifas", href: "/dashboard/tarifas" },
    { title: "Plantillas", href: "/dashboard/plantillas" },
    { title: "Empleados", href: "/dashboard/empleados" },
    { title: "Pagos", href: "/dashboard/configuracion-pagos" },
    { title: "Configurar Zona", href: "/dashboard/configuracion-zona" },
    { title: "Ver Plazas", href: "/dashboard/visualizacion-plazas" },
    { title: "Configuración Avanzada", href: "/dashboard/plazas/configuracion-avanzada" }
];

console.log('🔍 Verificando rutas del dashboard...\n');

console.log('📋 Rutas disponibles en el sistema:');
availableRoutes.forEach(route => console.log(`   ✅ ${route}`));

console.log('\n🎯 Acciones definidas en dashboard:');
dashboardActions.forEach(action => {
    const exists = availableRoutes.includes(action.href);
    console.log(`   ${exists ? '✅' : '❌'} ${action.title}: ${action.href}`);
});

console.log('\n📊 Resumen:');
const validRoutes = dashboardActions.filter(action => availableRoutes.includes(action.href)).length;
const totalRoutes = dashboardActions.length;
console.log(`   ✅ Rutas válidas: ${validRoutes}/${totalRoutes}`);
console.log(`   ❌ Rutas inválidas: ${totalRoutes - validRoutes}/${totalRoutes}`);

if (validRoutes === totalRoutes) {
    console.log('\n🎉 Todas las rutas son válidas!');
} else {
    console.log('\n⚠️  Algunas rutas necesitan corrección.');
}
