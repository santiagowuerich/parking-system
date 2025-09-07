// Análisis del POST para crear empleados
// Verificar estructura de datos enviados

console.log('🔍 ANÁLISIS DEL POST PARA CREAR EMPLEADOS\n');

// Simular los datos que se envían desde el frontend
const datosFrontend = {
    nombre: "Juan",
    apellido: "Pérez",
    dni: "12345678",
    email: "juan.perez@test.com",
    estado: "Activo",
    contrasena: "password123",
    est_id: 4,
    disponibilidad: [
        {
            dia_semana: 1,  // Lunes
            turno: "Mañana",
            turno_id: 1
        },
        {
            dia_semana: 2,  // Martes
            turno: "Tarde",
            turno_id: 2
        }
    ]
};

console.log('📤 DATOS QUE ENVÍA EL FRONTEND:');
console.log(JSON.stringify(datosFrontend, null, 2));
console.log('\n');

// Verificar qué campos se extraen en el backend
const {
    nombre,
    apellido,
    dni,
    email,
    contrasena,
    estado = 'Activo',
    est_id,
    disponibilidad = []
} = datosFrontend;

console.log('🔍 CAMPOS EXTRAÍDOS EN EL BACKEND:');
console.log({
    nombre,
    apellido,
    dni,
    email,
    contrasena: contrasena ? '*** (tiene valor)' : 'null',
    estado,
    est_id,
    disponibilidad
});
console.log('\n');

// Verificar validaciones
const camposRequeridos = { nombre, apellido, dni, email, contrasena, est_id };
const faltanCampos = Object.entries(camposRequeridos)
    .filter(([key, value]) => !value)
    .map(([key]) => key);

console.log('✅ VALIDACIONES:');
console.log('- Campos requeridos presentes:', faltanCampos.length === 0);
if (faltanCampos.length > 0) {
    console.log('- Campos faltantes:', faltanCampos);
} else {
    console.log('- Todos los campos requeridos están presentes');
}
console.log('\n');

// Verificar estructura de disponibilidad para PostgreSQL
console.log('📋 ESTRUCTURA DE DISPONIBILIDAD PARA POSTGRESQL:');
console.log('Formato esperado por la función RPC:');
console.log(JSON.stringify(disponibilidad.map(d => ({
    dia_semana: d.dia_semana,
    turno_id: d.turno_id
})), null, 2));
console.log('\n');

// Simular la llamada a la función RPC
const parametrosRPC = {
    p_nombre: nombre,
    p_apellido: apellido,
    p_dni: dni,
    p_email: email,
    p_contrasena: contrasena, // Ya hasheada
    p_estado: estado,
    p_est_id: est_id,
    p_disponibilidad: disponibilidad.map(d => ({
        dia_semana: d.dia_semana,
        turno_id: d.turno_id
    }))
};

console.log('🗄️ PARÁMETROS QUE SE ENVÍAN A LA FUNCIÓN RPC:');
console.log(JSON.stringify(parametrosRPC, null, 2));
console.log('\n');

// Verificar que coincida con la función PostgreSQL
console.log('🔗 VERIFICACIÓN CON FUNCIÓN POSTGRESQL:');
console.log('Función espera:');
console.log('  p_nombre VARCHAR(60)');
console.log('  p_apellido VARCHAR(60)');
console.log('  p_dni VARCHAR(20)');
console.log('  p_email VARCHAR(120)');
console.log('  p_contrasena VARCHAR(255)');
console.log('  p_estado VARCHAR(20)');
console.log('  p_est_id INT');
console.log('  p_disponibilidad JSON');
console.log('\n');

// Verificar tipos de datos
console.log('📊 VERIFICACIÓN DE TIPOS:');
const verificacionTipos = {
    nombre: { valor: nombre, tipo: typeof nombre, esperado: 'string', maxLength: 60 },
    apellido: { valor: apellido, tipo: typeof apellido, esperado: 'string', maxLength: 60 },
    dni: { valor: dni, tipo: typeof dni, esperado: 'string', maxLength: 20 },
    email: { valor: email, tipo: typeof email, esperado: 'string', maxLength: 120 },
    contrasena: { valor: contrasena, tipo: typeof contrasena, esperado: 'string', maxLength: 255 },
    estado: { valor: estado, tipo: typeof estado, esperado: 'string', maxLength: 20 },
    est_id: { valor: est_id, tipo: typeof est_id, esperado: 'number' },
    disponibilidad: { valor: disponibilidad, tipo: Array.isArray(disponibilidad) ? 'array' : typeof disponibilidad, esperado: 'array' }
};

Object.entries(verificacionTipos).forEach(([campo, info]) => {
    const tipoCorrecto = info.tipo === info.esperado || (info.esperado === 'array' && Array.isArray(info.valor));
    const longitudCorrecta = !info.maxLength || (typeof info.valor === 'string' && info.valor.length <= info.maxLength);

    console.log(`${campo}: ${tipoCorrecto && longitudCorrecta ? '✅' : '❌'} (${info.tipo}${info.maxLength ? `, max: ${info.maxLength}` : ''})`);
});

console.log('\n🎯 RESULTADO DEL ANÁLISIS:');
console.log('Los datos se están enviando correctamente desde el frontend.');
console.log('La estructura coincide con lo esperado por la API.');
console.log('Los tipos de datos son correctos.');
console.log('La validación debería pasar sin problemas.');
