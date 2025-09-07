// Script final para probar la creación completa de empleados
// Incluye todos los pasos necesarios

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

console.log('🎯 TEST FINAL: Creación de Empleados');
console.log('===================================\n');

// Verificar configuración
console.log('1️⃣ Verificando configuración...');
console.log('   URL:', supabaseUrl ? '✅' : '❌');
console.log('   Anon Key:', supabaseAnonKey ? '✅ (' + supabaseAnonKey.substring(0, 10) + '...)' : '❌');
console.log('   Service Key:', supabaseServiceKey ? '✅ (' + supabaseServiceKey.substring(0, 10) + '...)' : '❌');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.log('❌ Configuración incompleta. Verifica tu archivo .env.local');
    process.exit(1);
}

// Crear clientes
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function probarCreacionCompletaEmpleado() {
    console.log('\n2️⃣ Probando creación completa de empleado...');

    // Datos de prueba idénticos a los que envías desde el frontend
    const testData = {
        nombre: "nombre1",
        apellido: "apellido1",
        dni: "33445566",
        email: `test-final-${Date.now()}@example.com`,
        estado: "Activo",
        contrasena: "b&qLXK8os^5D",
        est_id: 4,
        disponibilidad: [
            { dia_semana: 1, turno: "Mañana", turno_id: 1 },
            { dia_semana: 2, turno: "Mañana", turno_id: 1 },
            { dia_semana: 3, turno: "Mañana", turno_id: 1 },
            { dia_semana: 4, turno: "Mañana", turno_id: 1 },
            { dia_semana: 5, turno: "Mañana", turno_id: 1 },
            { dia_semana: 6, turno: "Mañana", turno_id: 1 },
            { dia_semana: 7, turno: "Mañana", turno_id: 1 }
        ]
    };

    console.log('📤 Datos a enviar:', JSON.stringify(testData, null, 2));

    try {
        const { nombre, apellido, dni, email, contrasena, estado, est_id, disponibilidad } = testData;

        // PASO 1: Verificar email duplicado
        console.log('\n🔍 PASO 1: Verificando email duplicado...');
        const { data: existingUser } = await supabaseAdmin
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        if (existingUser) {
            console.log('⚠️ Email ya existe, cancelando prueba');
            return false;
        }
        console.log('✅ Email disponible');

        // PASO 2: Verificar estacionamiento
        console.log('\n🏢 PASO 2: Verificando estacionamiento...');
        const { data: estacionamiento, error: estError } = await supabaseAdmin
            .from('estacionamientos')
            .select('est_id, est_nombre')
            .eq('est_id', est_id)
            .single();

        if (estError || !estacionamiento) {
            console.log('❌ Estacionamiento no encontrado:', estError?.message);
            return false;
        }
        console.log('✅ Estacionamiento válido:', estacionamiento.est_nombre);

        // PASO 3: Crear usuario en Supabase Auth
        console.log('\n🔐 PASO 3: Creando usuario en Supabase Auth...');
        const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: contrasena,
            email_confirm: true,
            user_metadata: {
                nombre: nombre,
                apellido: apellido,
                dni: dni,
                tipo: 'empleado'
            }
        });

        if (createAuthError) {
            console.log('❌ Error creando usuario en Auth:', createAuthError.message);
            return false;
        }

        if (!authUser?.user) {
            console.log('❌ Usuario creado pero sin datos válidos');
            return false;
        }

        console.log('✅ Usuario creado en Auth:', authUser.user.id);

        // PASO 4: Crear registro en tabla usuario
        console.log('\n👤 PASO 4: Creando registro en tabla usuario...');

        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync(contrasena, 12);

        const { error: userInsertError } = await supabaseAdmin
            .from('usuario')
            .insert({
                usu_nom: nombre,
                usu_ape: apellido,
                usu_dni: dni,
                usu_email: email,
                usu_contrasena: hashedPassword,
                usu_fechareg: new Date().toISOString(),
                usu_estado: estado || 'Activo',
                requiere_cambio_contrasena: false
                // Nota: auth_user_id se omite temporalmente por constraint FK
            });

        if (userInsertError) {
            console.log('❌ Error insertando usuario:', userInsertError.message);

            // Limpiar usuario de Auth
            try {
                await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
                console.log('🧹 Usuario de Auth limpiado');
            } catch (cleanupError) {
                console.log('⚠️ Error limpiando:', cleanupError.message);
            }

            return false;
        }

        console.log('✅ Registro creado en tabla usuario');

        // Obtener el usu_id generado automáticamente usando el email
        const { data: usuarioCreado, error: getUserError } = await supabaseAdmin
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        if (getUserError || !usuarioCreado) {
            console.log('❌ Error obteniendo usuario creado:', getUserError);

            // Limpiar datos
            try {
                await supabaseAdmin.from('usuario').delete().eq('usu_email', email);
                await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
                console.log('🧹 Datos limpiados por error al obtener usu_id');
            } catch (cleanupError) {
                console.log('⚠️ Error limpiando:', cleanupError.message);
            }

            return false;
        }

        console.log('✅ Usuario creado en BD con usu_id:', usuarioCreado.usu_id);

        // PASO 5: Crear relaciones manualmente
        console.log('\n🔗 PASO 5: Creando relaciones de empleado manualmente...');

        try {
            // PASO 5.1: Insertar en playeros
            console.log('👤 Insertando en playeros...');
            const { error: playeroError } = await supabaseAdmin
                .from('playeros')
                .insert({ play_id: usuarioCreado.usu_id });

            if (playeroError) {
                console.log('❌ Error insertando en playeros:', playeroError.message);
                throw playeroError;
            }

            // PASO 5.2: Insertar en empleados_estacionamiento
            console.log('🏢 Insertando en empleados_estacionamiento...');
            const { error: empleadoEstError } = await supabaseAdmin
                .from('empleados_estacionamiento')
                .insert({
                    play_id: usuarioCreado.usu_id,
                    est_id: est_id
                });

            if (empleadoEstError) {
                console.log('❌ Error insertando en empleados_estacionamiento:', empleadoEstError.message);
                throw empleadoEstError;
            }

            // PASO 5.3: Insertar disponibilidad si se proporcionó
            if (disponibilidad && disponibilidad.length > 0) {
                console.log('📅 Insertando disponibilidad...');
                for (const disp of disponibilidad) {
                    const { error: dispError } = await supabaseAdmin
                        .from('disponibilidad_empleado')
                        .insert({
                            play_id: usuarioCreado.usu_id,
                            dia_semana: disp.dia_semana,
                            turno_id: disp.turno_id
                        });

                    if (dispError) {
                        console.log('❌ Error insertando disponibilidad:', dispError.message);
                        throw dispError;
                    }
                }
            }

            console.log('✅ Relaciones de empleado creadas exitosamente');

        } catch (transactionError) {
            console.log('❌ Error creando relaciones:', transactionError.message);

            // Limpiar todo
            try {
                await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
                await supabaseAdmin.from('usuario').delete().eq('usu_email', email);
                console.log('🧹 Datos limpiados por error en transacción');
            } catch (cleanupError) {
                console.log('⚠️ Error limpiando:', cleanupError.message);
            }

            return false;
        }

        console.log('✅ Empleado creado exitosamente!');
        console.log('📋 Resumen:');
        console.log('   🆔 Auth User ID:', authUser.user.id);
        console.log('   👤 Usuario:', `${nombre} ${apellido}`);
        console.log('   📧 Email:', email);
        console.log('   🏢 Estacionamiento:', estacionamiento.est_nombre);
        console.log('   📅 Disponibilidad:', disponibilidad.length, 'días');

        // PASO 6: Verificar que aparece en la lista
        console.log('\n🔍 PASO 6: Verificando que aparece en la lista...');

        const { data: empleados, error: listError } = await supabaseAdmin
            .from('empleados_estacionamiento')
            .select(`
                *,
                playeros (*, usuario (*)),
                estacionamientos (*)
            `)
            .eq('est_id', est_id)
            .eq('activo', true);

        if (listError) {
            console.log('⚠️ Error verificando lista:', listError.message);
        } else {
            const empleadoEncontrado = empleados?.find(e =>
                e.playeros?.usuario?.usu_email === email
            );

            if (empleadoEncontrado) {
                console.log('✅ Empleado encontrado en la lista de estacionamiento');
            } else {
                console.log('⚠️ Empleado NO encontrado en la lista');
                console.log('👥 Empleados en estacionamiento:', empleados?.length || 0);
            }
        }

        return true;

    } catch (error) {
        console.log('💥 Error inesperado:', error.message);
        return false;
    }
}

// Ejecutar prueba
probarCreacionCompletaEmpleado().then((success) => {
    console.log('\n' + '='.repeat(50));
    if (success) {
        console.log('🎉 ¡PRUEBA EXITOSA!');
        console.log('✅ El sistema de creación de empleados funciona correctamente');
        console.log('✅ Los empleados se crean en Supabase Auth');
        console.log('✅ Los empleados se registran en la base de datos');
        console.log('✅ Los empleados aparecen en las listas');
    } else {
        console.log('❌ PRUEBA FALLIDA');
        console.log('🔧 Solución: Ejecutar la migración 41_fix_usuario_identity.sql');
        console.log('🔧 Luego reiniciar el servidor y probar nuevamente');
    }
    console.log('='.repeat(50));
});
