// Script para arreglar el usuario prueba24@gmail.com
// Agregar registro faltante en tabla dueno

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixUser() {
    console.log('🔧 Arreglando usuario prueba24@gmail.com...\n');

    try {
        // 1. Buscar usuario
        console.log('1. Buscando usuario...');
        const { data: usuario, error: userError } = await supabase
            .from('usuario')
            .select('*')
            .eq('usu_email', 'prueba24@gmail.com')
            .single();

        if (userError || !usuario) {
            console.log('❌ Usuario no encontrado');
            return;
        }

        console.log(`✅ Usuario encontrado - ID: ${usuario.usu_id}`);

        // 2. Verificar si ya tiene registro como dueño
        console.log('\n2. Verificando registro como dueño...');
        const { data: duenoExistente, error: duenoError } = await supabase
            .from('dueno')
            .select('*')
            .eq('due_id', usuario.usu_id)
            .single();

        if (duenoExistente) {
            console.log('✅ Usuario ya es dueño');
            return;
        }

        // 3. Crear registro como dueño
        console.log('👑 Creando registro de dueño...');
        const { data: nuevoDueno, error: createError } = await supabase
            .from('dueno')
            .insert({ due_id: usuario.usu_id })
            .select()
            .single();

        if (createError) {
            console.log('❌ Error creando registro de dueño:', createError);
            return;
        }

        console.log('✅ Registro de dueño creado exitosamente:', nuevoDueno);

        // 4. Verificar que ahora tenga rol 'owner'
        console.log('\n4. Verificando rol asignado...');
        const { data: roleCheck, error: roleError } = await supabase
            .from('usuario')
            .select(`
        usu_id,
        dueno!left(due_id)
      `)
            .eq('usu_id', usuario.usu_id)
            .single();

        if (roleCheck?.dueno && roleCheck.dueno.length > 0) {
            console.log('🎯 Rol asignado correctamente: OWNER');
        } else {
            console.log('⚠️ Todavía no se detecta como owner');
        }

        console.log('\n✅ Usuario arreglado exitosamente!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

fixUser();
