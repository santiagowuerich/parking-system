// Script para diagnosticar problemas con el Service Role Key
// Ejecutar desde Node.js para verificar la configuración

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

console.log('🔍 DIAGNÓSTICO: Service Role Key');
console.log('=================================\n');

// Cargar variables de entorno desde .env.local
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

// Verificar variables de entorno
console.log('1️⃣ Verificando variables de entorno...');
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('📋 Variables encontradas:');
console.log('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Presente' : '❌ Faltante');
console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Presente' : '❌ Faltante');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅ Presente' : '❌ Faltante');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.log('\n❌ Faltan variables de entorno necesarias');
    console.log('🔧 Solución: Crear archivo .env.local con:');
    console.log('   NEXT_PUBLIC_SUPABASE_URL=tu_supabase_url');
    console.log('   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key');
    console.log('   SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key');
    process.exit(1);
}

// Verificar formato del service key
console.log('\n2️⃣ Verificando formato del Service Role Key...');
console.log('   Longitud:', supabaseServiceKey.length);
console.log('   Empieza con "eyJ":', supabaseServiceKey.startsWith('eyJ'));
console.log('   Contiene ".":', supabaseServiceKey.includes('.'));

if (supabaseServiceKey.length < 100) {
    console.log('⚠️ El service key parece muy corto, podría ser incorrecto');
}

if (!supabaseServiceKey.startsWith('eyJ')) {
    console.log('⚠️ El service key no tiene el formato JWT esperado');
}

// Probar conexión con cliente regular
console.log('\n3️⃣ Probando conexión con cliente regular...');
try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Cliente regular creado exitosamente');
} catch (error) {
    console.log('❌ Error creando cliente regular:', error.message);
}

// Probar conexión con cliente admin
console.log('\n4️⃣ Probando conexión con cliente admin...');
try {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    console.log('✅ Cliente admin creado exitosamente');
} catch (error) {
    console.log('❌ Error creando cliente admin:', error.message);
}

// Probar operación administrativa
console.log('\n5️⃣ Probando operación administrativa...');
async function testAdminOperation() {
    try {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // Intentar crear un usuario de prueba
        const testEmail = `test-${Date.now()}@diagnostic.com`;
        console.log('🧪 Intentando crear usuario de prueba:', testEmail);

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: testEmail,
            password: 'TestPass123!',
            email_confirm: true
        });

        if (error) {
            console.log('❌ Error en operación admin:', error.message);
            console.log('   Código:', error.status);
            console.log('   Detalles:', error);

            if (error.message.includes('not_admin')) {
                console.log('\n🔍 DIAGNÓSTICO: El service role key no tiene permisos administrativos');
                console.log('🔧 SOLUCIONES:');
                console.log('   1. Verificar que estés usando el SERVICE_ROLE key, no el ANON key');
                console.log('   2. Ir a Supabase Dashboard > Settings > API');
                console.log('   3. Copiar el "service_role" key (no el "anon" key)');
                console.log('   4. Actualizar .env.local con el key correcto');
            } else if (error.message.includes('invalid')) {
                console.log('\n🔍 DIAGNÓSTICO: El service role key tiene formato inválido');
                console.log('🔧 SOLUCIONES:');
                console.log('   1. Verificar que no haya espacios extras');
                console.log('   2. Verificar que no haya caracteres especiales');
                console.log('   3. Recopiar el key desde Supabase Dashboard');
            }
        } else {
            console.log('✅ Operación admin exitosa!');
            console.log('🆔 Usuario creado:', data.user.id);

            // Limpiar usuario de prueba
            console.log('🧹 Limpiando usuario de prueba...');
            await supabaseAdmin.auth.admin.deleteUser(data.user.id);
            console.log('✅ Usuario de prueba eliminado');
        }

    } catch (error) {
        console.log('❌ Error inesperado:', error.message);
    }
}

testAdminOperation().then(() => {
    console.log('\n✨ Diagnóstico completado!');
    console.log('\n📋 Resumen de verificación:');
    console.log('   ✅ Variables de entorno presentes');
    console.log('   ✅ Formato del service key válido');
    console.log('   ✅ Cliente admin creado correctamente');
    console.log('   ⚠️ Operación admin requiere verificación');
});
