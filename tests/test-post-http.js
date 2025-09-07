// Test HTTP real para verificar el POST de empleados
// Requiere que el servidor esté corriendo

const https = require('http');

const testData = {
    nombre: "Carlos",
    apellido: "Rodríguez",
    dni: "11223344",
    email: `carlos.rodriguez-${Date.now()}@test.com`,
    contrasena: "TestPass123!",
    estado: "Activo",
    est_id: 4,
    disponibilidad: [
        { dia_semana: 1, turno_id: 1 },
        { dia_semana: 4, turno_id: 2 }
    ]
};

console.log('🌐 TEST HTTP REAL - POST EMPLEADOS\n');
console.log('📤 Datos a enviar:', JSON.stringify(testData, null, 2));
console.log('\n');

// Configuración de la petición
const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/empleados',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(testData))
    }
};

console.log('🔗 URL completa:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('📊 Método:', options.method);
console.log('📋 Headers:', options.headers);
console.log('\n');

const req = https.request(options, (res) => {
    console.log('📡 RESPUESTA RECIBIDA:');
    console.log('📊 Status Code:', res.statusCode);
    console.log('📋 Status Message:', res.statusMessage);
    console.log('📄 Headers:', res.headers);
    console.log('\n');

    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📦 CUERPO DE LA RESPUESTA:');
        try {
            const jsonData = JSON.parse(data);
            console.log(JSON.stringify(jsonData, null, 2));
        } catch (e) {
            console.log('Respuesta no JSON:', data);
        }

        console.log('\n🎯 ANÁLISIS DE LA RESPUESTA:');

        if (res.statusCode === 201) {
            console.log('✅ Empleado creado exitosamente');
            console.log('🎉 El POST está funcionando correctamente');
        } else if (res.statusCode === 401) {
            console.log('❌ Error de autenticación');
            console.log('💡 El problema es que no hay sesión de usuario válida');
        } else if (res.statusCode === 403) {
            console.log('❌ Error de permisos');
            console.log('💡 El usuario no tiene permisos sobre el estacionamiento');
        } else if (res.statusCode === 400) {
            console.log('❌ Error de validación');
            console.log('💡 Faltan campos requeridos o hay datos inválidos');
        } else if (res.statusCode === 409) {
            console.log('❌ Email duplicado');
            console.log('💡 Ya existe un usuario con ese email');
        } else if (res.statusCode === 500) {
            console.log('❌ Error interno del servidor');
            console.log('💡 Problema en la base de datos o función RPC');
        } else {
            console.log('❓ Código de estado desconocido:', res.statusCode);
        }
    });
});

req.on('error', (error) => {
    console.log('❌ ERROR EN LA PETICIÓN:');
    console.log('Tipo de error:', error.code);
    console.log('Mensaje:', error.message);

    if (error.code === 'ECONNREFUSED') {
        console.log('💡 El servidor no está corriendo o no está accesible');
        console.log('🔧 Verifica que el servidor esté ejecutándose en localhost:3000');
    }
});

req.write(JSON.stringify(testData));
req.end();
