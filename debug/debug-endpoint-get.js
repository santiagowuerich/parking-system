// Script para verificar el endpoint GET de empleados
// Ejecutar desde Node.js para diagnosticar problemas

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

async function testEndpointGET() {
    console.log('🔍 DIAGNÓSTICO: Endpoint GET /api/empleados');
    console.log('===========================================\n');

    const { createClient } = require('@supabase/supabase-js');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    console.log('1️⃣ Verificando empleados en BD...');

    // Consulta directa a la base de datos
    const { data: empleadosBD, error: errorBD } = await supabaseAdmin
        .from('empleados_estacionamiento')
        .select(`
            *,
            playeros (
                *,
                usuario (*)
            ),
            estacionamientos (
                est_id,
                est_nombre,
                est_locali
            )
        `)
        .eq('est_id', 4)
        .eq('activo', true);

    if (errorBD) {
        console.log('❌ Error en consulta BD:', errorBD);
        return;
    }

    console.log('✅ Empleados en BD:', empleadosBD?.length || 0);

    empleadosBD?.forEach((emp, index) => {
        console.log(`   ${index + 1}. ID: ${emp.playeros?.usuario?.usu_id}, Nombre: ${emp.playeros?.usuario?.usu_nom} ${emp.playeros?.usuario?.usu_ape}`);
    });

    // Buscar específicamente el empleado 7
    const empleado7 = empleadosBD?.find(emp => emp.playeros?.usuario?.usu_id === 30);
    if (empleado7) {
        console.log('\n🎯 Empleado 7 encontrado en BD:', {
            usu_id: empleado7.playeros?.usuario?.usu_id,
            nombre: empleado7.playeros?.usuario?.usu_nom,
            apellido: empleado7.playeros?.usuario?.usu_ape,
            email: empleado7.playeros?.usuario?.usu_email,
            estado: empleado7.playeros?.usuario?.usu_estado
        });
    } else {
        console.log('\n❌ Empleado 7 NO encontrado en BD');
    }

    console.log('\n2️⃣ Verificando disponibilidad...');

    // Obtener IDs de empleados para consultar disponibilidad
    const empleadosIds = empleadosBD?.map(emp => emp.play_id) || [];

    if (empleadosIds.length > 0) {
        const { data: disponibilidad, error: dispError } = await supabaseAdmin
            .from('disponibilidad_empleado')
            .select(`
                play_id,
                dia_semana,
                turno_id,
                turnos_catalogo (
                    nombre_turno
                )
            `)
            .in('play_id', empleadosIds);

        if (dispError) {
            console.log('❌ Error obteniendo disponibilidad:', dispError);
        } else {
            console.log('✅ Disponibilidad obtenida:', disponibilidad?.length || 0, 'registros');

            // Verificar disponibilidad del empleado 7
            const dispEmpleado7 = disponibilidad?.filter(d => d.play_id === 30);
            if (dispEmpleado7 && dispEmpleado7.length > 0) {
                console.log('📅 Disponibilidad empleado 7:', dispEmpleado7);
            } else {
                console.log('📅 Empleado 7 sin disponibilidad configurada');
            }
        }
    }

    console.log('\n3️⃣ Simulando transformación de datos...');

    // Simular la transformación que hace el endpoint
    const empleadosFormateados = empleadosBD?.map(emp => {
        const usuario = emp.playeros.usuario;
        const estacionamiento = emp.estacionamientos;

        return {
            usu_id: usuario.usu_id,
            nombre: usuario.usu_nom,
            apellido: usuario.usu_ape,
            dni: usuario.usu_dni,
            email: usuario.usu_email,
            estado: usuario.usu_estado,
            requiere_cambio_contrasena: usuario.requiere_cambio_contrasena,
            disponibilidad: [], // Simplificado para el test
            estacionamiento: {
                est_id: estacionamiento.est_id,
                est_nombre: estacionamiento.est_nombre,
                est_locali: estacionamiento.est_locali
            }
        };
    });

    console.log('✅ Empleados formateados:', empleadosFormateados?.length || 0);

    const empleado7Formateado = empleadosFormateados?.find(emp => emp.usu_id === 30);
    if (empleado7Formateado) {
        console.log('🎯 Empleado 7 formateado:', empleado7Formateado);
    } else {
        console.log('❌ Empleado 7 NO encontrado en datos formateados');
    }

    console.log('\n✨ Diagnóstico completado!');
    console.log('\n📋 Resumen:');
    console.log('   - Empleados en BD:', empleadosBD?.length || 0);
    console.log('   - Empleado 7 en BD:', empleado7 ? '✅' : '❌');
    console.log('   - Empleado 7 formateado:', empleado7Formateado ? '✅' : '❌');
}

testEndpointGET().catch(console.error);
