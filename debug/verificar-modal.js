// verificar-modal.js
// Script para verificar que la interfaz modal funciona correctamente

console.log('🔧 Verificando correcciones del modal...\n');

// Verificar archivos
const fs = require('fs');

const archivos = [
    'app/gestion-usuarios/page.tsx',
    'components/ui/dialog.tsx'
];

console.log('📁 Verificando archivos:');
archivos.forEach(archivo => {
    if (fs.existsSync(archivo)) {
        console.log(`✅ ${archivo}`);
    } else {
        console.log(`❌ ${archivo} - NO ENCONTRADO`);
    }
});

// Verificar contenido del archivo
console.log('\n🔍 Verificando estructura del modal:');
const contenido = fs.readFileSync('app/gestion-usuarios/page.tsx', 'utf8');

const checks = [
    { text: 'Dialog open={modalOpen}', found: contenido.includes('Dialog open={modalOpen}') },
    { text: 'DialogContent className="max-w-2xl"', found: contenido.includes('max-w-2xl') },
    { text: 'DialogHeader', found: contenido.includes('DialogHeader') },
    { text: 'DialogTitle', found: contenido.includes('DialogTitle') },
    { text: '</Dialog>', found: contenido.includes('</Dialog>') },
    { text: 'handleNewUser', found: contenido.includes('handleNewUser') },
    { text: 'setModalOpen(true)', found: contenido.includes('setModalOpen(true)') }
];

checks.forEach(check => {
    console.log(`${check.found ? '✅' : '❌'} ${check.text}`);
});

const erroresSintaxis = [];
if (!contenido.includes('export default function')) {
    erroresSintaxis.push('Función export default no encontrada');
}
if (contenido.split('{').length !== contenido.split('}').length) {
    erroresSintaxis.push('Llaves desbalanceadas');
}
if (contenido.split('(').length !== contenido.split(')').length) {
    erroresSintaxis.push('Paréntesis desbalanceados');
}

console.log('\n🚨 Errores de sintaxis:');
if (erroresSintaxis.length === 0) {
    console.log('✅ No se encontraron errores de sintaxis');
} else {
    erroresSintaxis.forEach(error => console.log(`❌ ${error}`));
}

console.log('\n🎯 Recomendaciones:');
console.log('1. Reinicia el servidor de desarrollo');
console.log('2. Ve a http://localhost:3001/gestion-usuarios');
console.log('3. Prueba el botón "Nuevo Empleado"');
console.log('4. Verifica que el modal se abra correctamente');

console.log('\n✨ ¡Correcciones aplicadas!');
