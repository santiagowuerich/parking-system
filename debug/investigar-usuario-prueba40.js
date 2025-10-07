// Script para investigar el usuario prueba40@gmail.com
const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = 'https://bkaoigwrzbcufelectsl.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrYW9pZ3dyemJjdWZlbGVjdHNsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzY1NTk5NiwiZXhwIjoyMDU5MjMxOTk2fQ.ICRos9vMQR4kOVlzxCXZngnnas_WnCi_2mzIvR3pURo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function investigarUsuario() {
    console.log('🔍 Investigando usuario: prueba40@gmail.com');
    console.log('=====================================');

    try {
        // 1. Buscar usuario en tabla usuario
        console.log('\n1️⃣ Buscando en tabla usuario...');
        const { data: usuario, error: userError } = await supabase
            .from('usuario')
            .select('*')
            .eq('usu_email', 'prueba40@gmail.com')
            .single();

        if (userError) {
            console.log('❌ Error buscando usuario:', userError.message);
            return;
        }

        if (!usuario) {
            console.log('❌ Usuario no encontrado en tabla usuario');
            return;
        }

        console.log('✅ Usuario encontrado:', {
            usu_id: usuario.usu_id,
            usu_nom: usuario.usu_nom,
            usu_ape: usuario.usu_ape,
            usu_email: usuario.usu_email,
            usu_estado: usuario.usu_estado
        });

        // 2. Verificar si es dueño
        console.log('\n2️⃣ Verificando si es DUEÑO...');
        const { data: dueno, error: duenoError } = await supabase
            .from('dueno')
            .select('*')
            .eq('due_id', usuario.usu_id)
            .single();

        if (duenoError && duenoError.code !== 'PGRST116') {
            console.log('❌ Error buscando dueño:', duenoError.message);
        } else if (dueno) {
            console.log('✅ Usuario ES DUEÑO:', dueno);
        } else {
            console.log('❌ Usuario NO es dueño');
        }

        // 3. Verificar si es empleado (playero)
        console.log('\n3️⃣ Verificando si es EMPLEADO (playero)...');
        const { data: playero, error: playeroError } = await supabase
            .from('playeros')
            .select('*')
            .eq('play_id', usuario.usu_id)
            .single();

        if (playeroError && playeroError.code !== 'PGRST116') {
            console.log('❌ Error buscando playero:', playeroError.message);
        } else if (playero) {
            console.log('✅ Usuario ES EMPLEADO (playero):', playero);
        } else {
            console.log('❌ Usuario NO es empleado');
        }

        // 4. Verificar asignaciones de empleado
        if (playero) {
            console.log('\n4️⃣ Verificando asignaciones de empleado...');
            const { data: asignaciones, error: asignError } = await supabase
                .from('empleados_estacionamiento')
                .select(`
                    *,
                    estacionamientos (
                        est_id,
                        est_nombre,
                        est_locali
                    )
                `)
                .eq('play_id', usuario.usu_id);

            if (asignError) {
                console.log('❌ Error buscando asignaciones:', asignError.message);
            } else {
                console.log('📋 Asignaciones encontradas:', asignaciones);
            }
        }

        // 5. Verificar si es conductor
        console.log('\n5️⃣ Verificando si es CONDUCTOR...');
        const { data: conductor, error: conductorError } = await supabase
            .from('conductores')
            .select('*')
            .eq('con_id', usuario.usu_id)
            .single();

        if (conductorError && conductorError.code !== 'PGRST116') {
            console.log('❌ Error buscando conductor:', conductorError.message);
        } else if (conductor) {
            console.log('✅ Usuario ES CONDUCTOR:', conductor);
        } else {
            console.log('❌ Usuario NO es conductor');
        }

        // 6. Resumen final
        console.log('\n📊 RESUMEN FINAL:');
        console.log('==================');
        console.log(`👤 Usuario ID: ${usuario.usu_id}`);
        console.log(`📧 Email: ${usuario.usu_email}`);
        console.log(`👑 Es DUEÑO: ${dueno ? 'SÍ' : 'NO'}`);
        console.log(`👷 Es EMPLEADO: ${playero ? 'SÍ' : 'NO'}`);
        console.log(`🚗 Es CONDUCTOR: ${conductor ? 'SÍ' : 'NO'}`);

        if (dueno && playero) {
            console.log('\n⚠️  PROBLEMA DETECTADO:');
            console.log('El usuario tiene registros en AMBAS tablas (dueno Y playeros)');
            console.log('El sistema actual prioriza DUEÑO sobre EMPLEADO');
            console.log('Por eso se detecta como owner en lugar de playero');
        }

    } catch (error) {
        console.error('❌ Error general:', error);
    }
}

// Ejecutar investigación
investigarUsuario();
