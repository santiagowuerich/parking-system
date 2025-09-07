// Script específico para probar la edición de empleados
// Enfocado en el endpoint PUT

const fs = require('fs');

// Cargar variables de entorno
function loadEnvFile() {
    try {
        if (fs.existsSync('.env.local')) {
            const envContent = fs.readFileSync('.env.local', 'utf8');
            const envVars = {};

            envContent.split('\n').forEach(line => {
                const [key, ...valueParts] = line.split('=');
                if (key && valueParts.length > 0) {
                    envVars[key.trim()] = valueParts.join('=').trim();
                }
            });

            return envVars;
        }
    } catch (error) {
        console.log('❌ Error leyendo .env.local:', error.message);
    }

    return {};
}

const envVars = loadEnvFile();
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testEdicionPUT() {
    console.log('🔧 TEST ESPECÍFICO: Endpoint PUT /api/empleados');
    console.log('=================================================\n');

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 1. Obtener un empleado existente
    console.log('1️⃣ Obteniendo empleado existente...');

    const { data: empleados, error: empleadosError } = await supabaseAdmin
        .from('empleados_estacionamiento')
        .select(`
            *,
            playeros (
                *,
                usuario (*)
            )
        `)
        .eq('est_id', 4)
        .eq('activo', true)
        .limit(1);

    if (empleadosError || !empleados || empleados.length === 0) {
        console.log('❌ No se encontró ningún empleado para editar');
        return;
    }

    const empleado = empleados[0];
    const usuario = empleado.playeros.usuario;
    const empleadoId = usuario.usu_id;

    console.log('✅ Empleado encontrado:', {
        id: empleadoId,
        nombre: `${usuario.usu_nom} ${usuario.usu_ape}`,
        email: usuario.usu_email,
        estado: usuario.usu_estado
    });

    // 2. Preparar datos de edición
    console.log('\n2️⃣ Preparando datos de edición...');

    const nuevosDatos = {
        usu_id: empleadoId,
        nombre: usuario.usu_nom + ' (Editado)',
        apellido: usuario.usu_ape,
        email: usuario.usu_email,
        estado: usuario.usu_estado === 'Activo' ? 'Inactivo' : 'Activo',
        disponibilidad: [
            { dia_semana: 1, turno_id: 1 },
            { dia_semana: 2, turno_id: 2 },
            { dia_semana: 3, turno_id: 3 }
        ]
    };

    console.log('Datos a enviar:', JSON.stringify(nuevosDatos, null, 2));

    // 3. Hacer la petición PUT
    console.log('\n3️⃣ Ejecutando PUT request...');

    try {
        const response = await fetch('http://localhost:3000/api/empleados', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(nuevosDatos)
        });

        console.log('Status de respuesta:', response.status);
        console.log('Headers:', Object.fromEntries(response.headers.entries()));

        const result = await response.json();
        console.log('Resultado completo:', JSON.stringify(result, null, 2));

        if (!response.ok) {
            console.log('❌ Error en PUT request');
            return;
        }

        console.log('✅ PUT request exitosa');

    } catch (error) {
        console.log('❌ Error de conexión:', error.message);
        console.log('Stack trace:', error.stack);
        return;
    }

    // 4. Verificar cambios en BD
    console.log('\n4️⃣ Verificando cambios en base de datos...');

    // Verificar usuario
    const { data: usuarioActualizado, error: userError } = await supabaseAdmin
        .from('usuario')
        .select('*')
        .eq('usu_id', empleadoId)
        .single();

    if (userError) {
        console.log('❌ Error verificando usuario:', userError.message);
    } else {
        console.log('✅ Usuario actualizado:', {
            nombre: usuarioActualizado.usu_nom,
            estado: usuarioActualizado.usu_estado
        });
    }

    // Verificar disponibilidad
    const { data: disponibilidadActualizada, error: dispError } = await supabaseAdmin
        .from('disponibilidad_empleado')
        .select(`
            dia_semana,
            turno_id,
            turnos_catalogo (
                nombre_turno
            )
        `)
        .eq('play_id', empleadoId);

    if (dispError) {
        console.log('❌ Error verificando disponibilidad:', dispError.message);
    } else {
        console.log('✅ Disponibilidad actualizada:', disponibilidadActualizada?.length || 0, 'registros');
        if (disponibilidadActualizada) {
            disponibilidadActualizada.forEach((disp, index) => {
                console.log(`   ${index + 1}. Día ${disp.dia_semana}: ${disp.turnos_catalogo?.nombre_turno || 'Sin turno'}`);
            });
        }
    }

    console.log('\n✨ Test de edición completado!');
}

testEdicionPUT().catch(console.error);
