const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'your-supabase-url',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key'
);

async function fixUserRole() {
    console.log('🔧 Verificando y arreglando rol del usuario prueba23@gmail.com...\n');

    try {
        // 1. Buscar usuario por email
        console.log('1. Buscando usuario...');
        const { data: usuario, error: userError } = await supabase
            .from('usuario')
            .select('*')
            .eq('usu_email', 'prueba23@gmail.com')
            .single();

        if (userError || !usuario) {
            console.log('❌ Usuario no encontrado:', userError);
            return;
        }

        console.log('✅ Usuario encontrado:', {
            usu_id: usuario.usu_id,
            email: usuario.usu_email,
            auth_user_id: usuario.auth_user_id
        });

        // 2. Verificar si ya tiene registro como dueño
        console.log('\n2. Verificando registro como dueño...');
        const { data: duenoExistente, error: duenoError } = await supabase
            .from('dueno')
            .select('*')
            .eq('due_id', usuario.usu_id)
            .single();

        if (duenoExistente) {
            console.log('✅ Usuario YA es dueño:', duenoExistente);
        } else {
            console.log('⚠️ Usuario NO tiene registro como dueño. Creando...');

            // 3. Crear registro como dueño
            const { data: nuevoDueno, error: createError } = await supabase
                .from('dueno')
                .insert({ due_id: usuario.usu_id })
                .select()
                .single();

            if (createError) {
                console.log('❌ Error creando registro de dueño:', createError);
            } else {
                console.log('✅ Registro de dueño creado exitosamente:', nuevoDueno);
            }
        }

        // 4. Verificar si ya tiene estacionamiento
        console.log('\n3. Verificando estacionamiento...');
        const { data: estacionamiento, error: estError } = await supabase
            .from('estacionamientos')
            .select('*')
            .eq('due_id', usuario.usu_id)
            .single();

        if (estacionamiento) {
            console.log('✅ Usuario YA tiene estacionamiento:', estacionamiento);
        } else {
            console.log('⚠️ Usuario NO tiene estacionamiento. Esto es normal para usuarios nuevos.');
            console.log('ℹ️ El estacionamiento se creará cuando complete la configuración inicial.');
        }

        console.log('\n🎯 RESUMEN:');
        console.log(`   Usuario ID: ${usuario.usu_id}`);
        console.log(`   Email: ${usuario.usu_email}`);
        console.log(`   Es dueño: ${!!duenoExistente}`);
        console.log(`   Tiene estacionamiento: ${!!estacionamiento}`);
        console.log(`   Rol esperado: owner`);

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixUserRole();
