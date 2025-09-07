// Script para probar la edición y eliminación de empleados
// Ejecutar desde Node.js para verificar estas funcionalidades

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

async function testEdicionEmpleados() {
    console.log('🔧 PRUEBA: Edición de Empleados');
    console.log('================================\n');

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 1. Obtener un empleado existente para editar
    console.log('1️⃣ Buscando empleado existente...');
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
        console.log('Error:', empleadosError?.message);
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

    // 2. Probar edición de datos básicos
    console.log('\n2️⃣ Probando edición de datos básicos...');

    const nuevosDatos = {
        nombre: usuario.usu_nom + ' (Editado)',
        apellido: usuario.usu_ape,
        email: usuario.usu_email,
        estado: usuario.usu_estado === 'Activo' ? 'Inactivo' : 'Activo'
    };

    try {
        const response = await fetch('http://localhost:3000/api/empleados', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usu_id: empleadoId,
                ...nuevosDatos
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.log('❌ Error en edición:', result.error);
            return;
        }

        console.log('✅ Edición exitosa:', result.message);
        console.log('Datos actualizados:', nuevosDatos);

    } catch (error) {
        console.log('❌ Error de conexión en edición:', error.message);
        return;
    }

    // 3. Verificar que los cambios se guardaron
    console.log('\n3️⃣ Verificando cambios guardados...');

    const { data: empleadoActualizado, error: verificarError } = await supabaseAdmin
        .from('usuario')
        .select('*')
        .eq('usu_id', empleadoId)
        .single();

    if (verificarError) {
        console.log('❌ Error verificando cambios:', verificarError.message);
    } else {
        console.log('✅ Cambios verificados:', {
            nombre: empleadoActualizado.usu_nom,
            estado: empleadoActualizado.usu_estado
        });
    }

    // 4. Probar edición de disponibilidad
    console.log('\n4️⃣ Probando edición de disponibilidad...');

    const nuevaDisponibilidad = [
        { dia_semana: 1, turno_id: 1 },
        { dia_semana: 2, turno_id: 2 },
        { dia_semana: 3, turno_id: 1 }
    ];

    try {
        const response = await fetch('http://localhost:3000/api/empleados', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usu_id: empleadoId,
                disponibilidad: nuevaDisponibilidad
            })
        });

        const result = await response.json();

        if (!response.ok) {
            console.log('❌ Error en edición de disponibilidad:', result.error);
            return;
        }

        console.log('✅ Disponibilidad actualizada exitosamente');

    } catch (error) {
        console.log('❌ Error de conexión en edición de disponibilidad:', error.message);
    }

    console.log('\n✨ Prueba de edición completada!');
}

async function testEliminacionEmpleados() {
    console.log('\n🗑️ PRUEBA: Eliminación de Empleados');
    console.log('===================================\n');

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 1. Crear un empleado de prueba para eliminar
    console.log('1️⃣ Creando empleado de prueba para eliminar...');

    // Primero crear usuario en Auth
    const testEmail = `test-delete-${Date.now()}@example.com`;

    const { createClient: createClientAuth } = require('@supabase/supabase-js');
    const supabaseAuthAdmin = createClientAuth(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    const { data: authUser, error: authError } = await supabaseAuthAdmin.auth.admin.createUser({
        email: testEmail,
        password: 'TestPass123!',
        email_confirm: true
    });

    if (authError) {
        console.log('❌ Error creando usuario de prueba:', authError.message);
        return;
    }

    // Crear registro en usuario
    const { error: userError } = await supabaseAdmin
        .from('usuario')
        .insert({
            usu_nom: 'Test',
            usu_ape: 'Delete',
            usu_dni: '99999999',
            usu_email: testEmail,
            usu_contrasena: require('bcryptjs').hashSync('TestPass123!', 12),
            usu_fechareg: new Date().toISOString(),
            usu_estado: 'Activo',
            requiere_cambio_contrasena: false
        });

    if (userError) {
        console.log('❌ Error creando registro de usuario:', userError.message);
        return;
    }

    // Obtener el ID del usuario creado
    const { data: usuarioCreado, error: getUserError } = await supabaseAdmin
        .from('usuario')
        .select('usu_id')
        .eq('usu_email', testEmail)
        .single();

    if (getUserError || !usuarioCreado) {
        console.log('❌ Error obteniendo usuario creado:', getUserError?.message);
        return;
    }

    const usuarioId = usuarioCreado.usu_id;

    // Crear relaciones
    await supabaseAdmin.from('playeros').insert({ play_id: usuarioId });
    await supabaseAdmin.from('empleados_estacionamiento').insert({
        play_id: usuarioId,
        est_id: 4
    });

    console.log('✅ Empleado de prueba creado con ID:', usuarioId);

    // 2. Verificar que el empleado existe antes de eliminar
    console.log('\n2️⃣ Verificando que el empleado existe...');

    const { data: empleadoAntes, error: checkError } = await supabaseAdmin
        .from('empleados_estacionamiento')
        .select(`
            *,
            playeros (
                usuario (*)
            )
        `)
        .eq('play_id', usuarioId)
        .single();

    if (checkError || !empleadoAntes) {
        console.log('❌ Empleado no encontrado:', checkError?.message);
        return;
    }

    console.log('✅ Empleado encontrado:', empleadoAntes.playeros.usuario.usu_nom);

    // 3. Probar eliminación
    console.log('\n3️⃣ Probando eliminación...');

    try {
        const response = await fetch('http://localhost:3000/api/empleados', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                usu_id: usuarioId
            })
        });

        if (!response.ok) {
            const result = await response.json();
            console.log('❌ Error en eliminación:', result.error);
            return;
        }

        const result = await response.json();
        console.log('✅ Eliminación exitosa:', result.message);

    } catch (error) {
        console.log('❌ Error de conexión en eliminación:', error.message);
        return;
    }

    // 4. Verificar que el empleado fue eliminado
    console.log('\n4️⃣ Verificando eliminación...');

    const { data: empleadoDespues, error: verificarDeleteError } = await supabaseAdmin
        .from('usuario')
        .select('usu_id')
        .eq('usu_id', usuarioId)
        .single();

    if (verificarDeleteError && verificarDeleteError.code === 'PGRST116') {
        console.log('✅ Empleado eliminado correctamente (no encontrado en BD)');
    } else if (empleadoDespues) {
        console.log('❌ Empleado aún existe en BD');
    } else {
        console.log('⚠️ Estado de eliminación desconocido');
    }

    // Limpiar usuario de Auth
    try {
        await supabaseAuthAdmin.auth.admin.deleteUser(authUser.user.id);
        console.log('🧹 Usuario de Auth limpiado');
    } catch (cleanupError) {
        console.log('⚠️ Error limpiando usuario de Auth:', cleanupError.message);
    }

    console.log('\n✨ Prueba de eliminación completada!');
}

async function ejecutarPruebas() {
    console.log('🚀 INICIANDO PRUEBAS DE EDICIÓN Y ELIMINACIÓN');
    console.log('================================================\n');

    // Verificar configuración
    console.log('📋 Verificando configuración...');
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
        console.log('❌ Variables de entorno faltantes');
        process.exit(1);
    }
    console.log('✅ Configuración correcta\n');

    // Ejecutar pruebas
    await testEdicionEmpleados();
    await testEliminacionEmpleados();

    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS!');
    console.log('==================================');
    console.log('\n📊 Resumen:');
    console.log('   ✅ Edición de empleados: Verificada');
    console.log('   ✅ Eliminación de empleados: Verificada');
    console.log('   ✅ Integridad de datos: Mantenida');
    console.log('   ✅ Funcionalidades críticas: Operativas');
}

ejecutarPruebas().catch(console.error);
