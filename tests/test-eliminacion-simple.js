// Script simple para verificar eliminación
// Más enfocado en el problema específico

const fs = require('fs');

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
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testEliminacionSimple() {
    console.log('🗑️ TEST ELIMINACIÓN: Verificación simple');
    console.log('=======================================\n');

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // Crear empleado de prueba
    console.log('1️⃣ Creando empleado de prueba...');

    const testEmail = `test-delete-${Date.now()}@example.com`;

    // Crear en usuario
    const { error: userError } = await supabaseAdmin
        .from('usuario')
        .insert({
            usu_nom: 'Test',
            usu_ape: 'Delete',
            usu_email: testEmail,
            usu_contrasena: 'hashed',
            usu_fechareg: new Date().toISOString(),
            usu_estado: 'Activo'
        });

    if (userError) {
        console.log('❌ Error creando usuario:', userError.message);
        return;
    }

    // Obtener ID
    const { data: usuarioCreado } = await supabaseAdmin
        .from('usuario')
        .select('usu_id')
        .eq('usu_email', testEmail)
        .single();

    const usuarioId = usuarioCreado.usu_id;

    // Crear relaciones
    await supabaseAdmin.from('playeros').insert({ play_id: usuarioId });
    await supabaseAdmin.from('empleados_estacionamiento').insert({
        play_id: usuarioId,
        est_id: 4
    });

    console.log('✅ Empleado de prueba creado con ID:', usuarioId);

    // Probar eliminación
    console.log('\n2️⃣ Probando eliminación...');

    try {
        const response = await fetch('http://localhost:3000/api/empleados', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usu_id: usuarioId })
        });

        const result = await response.json();
        console.log('Status:', response.status);
        console.log('Resultado:', result);

        if (response.ok) {
            console.log('✅ Eliminación exitosa desde API');
        } else {
            console.log('❌ Error en eliminación desde API');
        }

    } catch (error) {
        console.log('❌ Error de conexión:', error.message);
    }

    // Verificar si realmente se eliminó
    console.log('\n3️⃣ Verificando eliminación en BD...');

    const { data: usuarioDespues } = await supabaseAdmin
        .from('usuario')
        .select('usu_id')
        .eq('usu_id', usuarioId)
        .single();

    if (usuarioDespues) {
        console.log('❌ Empleado aún existe en BD');
        console.log('   Puede ser problema de RLS o permisos');
    } else {
        console.log('✅ Empleado eliminado correctamente de BD');
    }

    console.log('\n✨ Test de eliminación completado!');
}

testEliminacionSimple().catch(console.error);
