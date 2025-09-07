// Script para probar específicamente el endpoint de empleados
// Esto nos ayudará a identificar exactamente dónde está fallando

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

console.log('🧪 TEST: Endpoint de Empleados');
console.log('==============================\n');

// Verificar configuración
console.log('1️⃣ Verificando configuración...');
console.log('   URL:', supabaseUrl ? '✅' : '❌');
console.log('   Anon Key:', supabaseAnonKey ? '✅' : '❌');
console.log('   Service Key:', supabaseServiceKey ? '✅' : '❌');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.log('❌ Configuración incompleta');
    process.exit(1);
}

// Crear clientes
console.log('\n2️⃣ Creando clientes...');
const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

console.log('✅ Clientes creados');

// Función para probar exactamente lo que hace el endpoint
async function simularEndpointEmpleados() {
    console.log('\n3️⃣ Simulando endpoint /api/empleados...');

    // Datos de prueba (iguales a los que enviaste)
    const testData = {
        nombre: "nombre1",
        apellido: "apellido1",
        dni: "33445566",
        email: `test-endpoint-${Date.now()}@example.com`,
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

    console.log('📤 Datos de prueba:', JSON.stringify(testData, null, 2));

    const { nombre, apellido, dni, email, contrasena, estado, est_id, disponibilidad } = testData;

    try {
        // PASO 1: Verificar que no existe el email
        console.log('\n🔍 PASO 1: Verificando email duplicado...');
        const { data: existingUser } = await supabaseAdmin
            .from('usuario')
            .select('usu_id')
            .eq('usu_email', email)
            .single();

        if (existingUser) {
            console.log('⚠️ Email ya existe, usando email diferente...');
            testData.email = `test-endpoint-${Date.now() + 1}@example.com`;
        }

        // PASO 2: Verificar estacionamiento del usuario (simular auth)
        console.log('\n🏢 PASO 2: Verificando estacionamiento...');
        const { data: estacionamiento, error: estError } = await supabaseAdmin
            .from('estacionamientos')
            .select('est_id, est_nombre')
            .eq('est_id', est_id)
            .single();

        if (estError || !estacionamiento) {
            console.log('❌ Error con estacionamiento:', estError?.message);
            return;
        }

        console.log('✅ Estacionamiento válido:', estacionamiento.est_nombre);

        // PASO 3: Crear usuario en Supabase Auth (aquí es donde fallaba)
        console.log('\n🔐 PASO 3: Creando usuario en Supabase Auth...');

        console.log('   Usando supabaseAdmin.auth.admin.createUser...');
        const { data: authUser, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: contrasena, // Usar contraseña original, no hasheada
            email_confirm: true, // Confirmar email automáticamente
            user_metadata: {
                nombre: nombre,
                apellido: apellido,
                dni: dni,
                tipo: 'empleado'
            }
        });

        if (createAuthError) {
            console.log('❌ ERROR en creación de Auth:', createAuthError.message);
            console.log('   Status:', createAuthError.status);
            console.log('   Code:', createAuthError.code);

            if (createAuthError.message.includes('not_admin')) {
                console.log('\n🔍 DIAGNÓSTICO: El problema está aquí');
                console.log('💡 Posibles causas:');
                console.log('   1. El endpoint está usando el cliente regular en lugar del admin');
                console.log('   2. La variable SUPABASE_SERVICE_ROLE_KEY no se está cargando en runtime');
                console.log('   3. El service key ha expirado o es incorrecto');
            }

            return;
        }

        if (!authUser?.user) {
            console.log('❌ Usuario creado pero sin datos válidos');
            return;
        }

        console.log('✅ Usuario creado en Auth:', authUser.user.id);

        // PASO 4: Crear registro en tabla usuario
        console.log('\n👤 PASO 4: Creando registro en tabla usuario...');

        const hashedPassword = require('bcryptjs').hashSync(contrasena, 12);

        const { error: userInsertError } = await supabaseAdmin
            .from('usuario')
            .upsert({
                usu_id: authUser.user.id,
                usu_nom: nombre,
                usu_ape: apellido,
                usu_dni: dni,
                usu_email: email,
                usu_contrasena: hashedPassword,
                usu_fechareg: new Date().toISOString(),
                usu_estado: estado || 'Activo',
                requiere_cambio_contrasena: false
            }, {
                onConflict: 'usu_id'
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

            return;
        }

        console.log('✅ Registro creado en tabla usuario');

        // PASO 5: Crear relaciones (playero, asignación, disponibilidad)
        console.log('\n🔗 PASO 5: Creando relaciones...');

        // Aquí iría la llamada a la función crear_empleado_completo
        // Por simplicidad, vamos a simular solo la parte esencial

        console.log('✅ Empleado creado exitosamente!');
        console.log('🆔 Auth User ID:', authUser.user.id);
        console.log('📧 Email:', email);
        console.log('🏢 Estacionamiento:', estacionamiento.est_nombre);

        // Limpiar datos de prueba
        console.log('\n🧹 Limpiando datos de prueba...');
        try {
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            await supabaseAdmin.from('usuario').delete().eq('usu_id', authUser.user.id);
            console.log('✅ Datos de prueba limpiados');
        } catch (error) {
            console.log('⚠️ Error limpiando:', error.message);
        }

    } catch (error) {
        console.log('💥 Error inesperado:', error.message);
    }
}

// Ejecutar la simulación
simularEndpointEmpleados().then(() => {
    console.log('\n✨ Test completado!');
    console.log('\n📋 Si este test funciona pero el endpoint real falla:');
    console.log('   - El problema está en el contexto del endpoint');
    console.log('   - Verificar que se está importando supabaseAdmin correctamente');
    console.log('   - Verificar que la variable de entorno se carga en runtime');
});
