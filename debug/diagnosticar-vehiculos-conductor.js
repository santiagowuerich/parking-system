const { createClient } = require('@supabase/supabase-js');

// Configuración de Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar service role para diagnóstico

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variables de entorno faltantes:');
    console.error('NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseKey);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnosticarVehiculos() {
    console.log('🔍 Diagnóstico de vehículos para conductores\n');

    try {
        // 1. Verificar estructura de la tabla vehiculos
        console.log('1️⃣ Verificando estructura de tabla vehiculos...');
        const { data: vehiculosStructure, error: structureError } = await supabase
            .from('vehiculos')
            .select('*')
            .limit(1);

        if (structureError) {
            console.error('❌ Error obteniendo estructura:', structureError);
        } else {
            console.log('✅ Estructura de tabla vehiculos:');
            if (vehiculosStructure && vehiculosStructure.length > 0) {
                console.log('   Campos disponibles:', Object.keys(vehiculosStructure[0]));
            } else {
                console.log('   Tabla vacía - obteniendo información de esquema...');
            }
        }

        // 2. Verificar tabla cat_vehiculo
        console.log('\n2️⃣ Verificando tabla cat_vehiculo...');
        const { data: categorias, error: catError } = await supabase
            .from('cat_vehiculo')
            .select('*');

        if (catError) {
            console.error('❌ Error obteniendo categorías:', catError);
        } else {
            console.log('✅ Categorías de vehículos disponibles:');
            categorias.forEach(cat => {
                console.log(`   ${cat.catv_segmento}: ${cat.catv_descripcion}`);
            });
        }

        // 3. Verificar conductores existentes
        console.log('\n3️⃣ Verificando conductores...');
        const { data: conductores, error: conError } = await supabase
            .from('conductores')
            .select('con_id')
            .limit(5);

        if (conError) {
            console.error('❌ Error obteniendo conductores:', conError);
        } else {
            console.log(`✅ Conductores encontrados: ${conductores.length}`);
            if (conductores.length > 0) {
                console.log('   IDs de conductores:', conductores.map(c => c.con_id));
            }
        }

        // 4. Verificar vehículos existentes
        console.log('\n4️⃣ Verificando vehículos existentes...');
        const { data: vehiculos, error: vehError } = await supabase
            .from('vehiculos')
            .select(`
                veh_patente,
                con_id,
                catv_segmento,
                cat_vehiculo!inner(catv_descripcion)
            `)
            .limit(10);

        if (vehError) {
            console.error('❌ Error obteniendo vehículos:', vehError);
        } else {
            console.log(`✅ Vehículos encontrados: ${vehiculos.length}`);
            vehiculos.forEach(veh => {
                console.log(`   Patente: ${veh.veh_patente}, Conductor: ${veh.con_id}, Tipo: ${veh.cat_vehiculo.catv_descripcion}`);
            });
        }

        // 5. Probar inserción de vehículo de prueba
        console.log('\n5️⃣ Probando inserción de vehículo de prueba...');
        const patentePrueba = `TEST${Date.now()}`;

        const { data: insertData, error: insertError } = await supabase
            .from('vehiculos')
            .insert({
                veh_patente: patentePrueba,
                con_id: conductores.length > 0 ? conductores[0].con_id : null,
                catv_segmento: 'A'
            })
            .select()
            .single();

        if (insertError) {
            console.error('❌ Error insertando vehículo de prueba:', insertError);
        } else {
            console.log('✅ Vehículo de prueba insertado correctamente:', insertData);

            // Limpiar vehículo de prueba
            await supabase
                .from('vehiculos')
                .delete()
                .eq('veh_patente', patentePrueba);
            console.log('🧹 Vehículo de prueba eliminado');
        }

        console.log('\n📋 Resumen del diagnóstico:');
        console.log('   - Tabla vehiculos existe:', !structureError);
        console.log('   - Categorías disponibles:', categorias?.length || 0);
        console.log('   - Conductores disponibles:', conductores?.length || 0);
        console.log('   - Vehículos existentes:', vehiculos?.length || 0);
        console.log('   - Inserción funciona:', !insertError);

    } catch (error) {
        console.error('💥 Error general en diagnóstico:', error);
    }
}

// Ejecutar diagnóstico
diagnosticarVehiculos();
