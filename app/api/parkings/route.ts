import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// GET - Obtener todos los estacionamientos públicos para conductores (con coordenadas)
export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                },
            }
        );

        console.log('🔍 Obteniendo estacionamientos públicos para mapa...');

        // Obtener estacionamientos que tengan coordenadas válidas
        const { data: estacionamientos, error } = await supabase
            .from('estacionamientos')
            .select(`
                est_id,
                est_nombre,
                est_direc,
                est_locali,
                est_prov,
                est_direccion_completa,
                est_latitud,
                est_longitud,
                est_capacidad,
                est_cantidad_espacios_disponibles,
                est_horario_funcionamiento,
                est_telefono,
                est_email
            `)
            .not('est_latitud', 'is', null)
            .not('est_longitud', 'is', null)
            .order('est_nombre');

        if (error) {
            console.error('❌ Error obteniendo estacionamientos:', error);
            return NextResponse.json(
                { error: "Error al obtener estacionamientos" },
                { status: 500 }
            );
        }

        // Filtrar y formatear datos para el mapa con disponibilidad en tiempo real
        const parkingsForMap = await Promise.all(
            estacionamientos?.map(async (parking) => {
                try {
                    // Calcular disponibilidad real consultando plazas
                    const { data: plazasData, error: plazasError } = await supabase
                        .from('plazas')
                        .select('pla_estado')
                        .eq('est_id', parking.est_id);

                    if (plazasError) {
                        console.error(`❌ Error obteniendo plazas para ${parking.est_id}:`, plazasError);
                        // Fallback al valor de BD si hay error
                        return {
                            id: parking.est_id,
                            nombre: parking.est_nombre,
                            direccion: parking.est_direc,
                            direccionCompleta: parking.est_direccion_completa || parking.est_direc,
                            localidad: parking.est_locali,
                            provincia: parking.est_prov,
                            latitud: parseFloat(parking.est_latitud),
                            longitud: parseFloat(parking.est_longitud),
                            capacidad: parking.est_capacidad,
                            espaciosDisponibles: parking.est_cantidad_espacios_disponibles,
                            horarioFuncionamiento: parking.est_horario_funcionamiento,
                            telefono: parking.est_telefono,
                            email: parking.est_email,
                            estado: parking.est_cantidad_espacios_disponibles > parking.est_capacidad * 0.5
                                ? 'disponible'
                                : parking.est_cantidad_espacios_disponibles > 0
                                    ? 'pocos'
                                    : 'lleno'
                        };
                    }

                    // Calcular disponibilidad real
                    const total = plazasData?.length || 0;
                    const ocupadas = plazasData?.filter(p => p.pla_estado === 'Ocupada').length || 0;
                    const libres = total - ocupadas;

                    console.log(`📊 Estacionamiento ${parking.est_id}: ${total} total, ${ocupadas} ocupadas, ${libres} libres`);

                    return {
                        id: parking.est_id,
                        nombre: parking.est_nombre,
                        direccion: parking.est_direc,
                        direccionCompleta: parking.est_direccion_completa || parking.est_direc,
                        localidad: parking.est_locali,
                        provincia: parking.est_prov,
                        latitud: parseFloat(parking.est_latitud),
                        longitud: parseFloat(parking.est_longitud),
                        capacidad: parking.est_capacidad,
                        espaciosDisponibles: libres, // ✅ Disponibilidad real calculada
                        horarioFuncionamiento: parking.est_horario_funcionamiento,
                        telefono: parking.est_telefono,
                        email: parking.est_email,
                        // Determinar estado basado en disponibilidad real
                        estado: libres > total * 0.5
                            ? 'disponible'
                            : libres > 0
                                ? 'pocos' // ✅ Corregido error tipográfico
                                : 'lleno'
                    };
                } catch (error) {
                    console.error(`❌ Error procesando estacionamiento ${parking.est_id}:`, error);
                    // Fallback en caso de error
                    return {
                        id: parking.est_id,
                        nombre: parking.est_nombre,
                        direccion: parking.est_direc,
                        direccionCompleta: parking.est_direccion_completa || parking.est_direc,
                        localidad: parking.est_locali,
                        provincia: parking.est_prov,
                        latitud: parseFloat(parking.est_latitud),
                        longitud: parseFloat(parking.est_longitud),
                        capacidad: parking.est_capacidad,
                        espaciosDisponibles: parking.est_cantidad_espacios_disponibles,
                        horarioFuncionamiento: parking.est_horario_funcionamiento,
                        telefono: parking.est_telefono,
                        email: parking.est_email,
                        estado: 'disponible' // Estado por defecto
                    };
                }
            }) || []
        );

        console.log(`✅ Encontrados ${parkingsForMap.length} estacionamientos con coordenadas`);

        return NextResponse.json({
            success: true,
            count: parkingsForMap.length,
            parkings: parkingsForMap
        });

    } catch (error) {
        console.error('❌ Error en GET /api/parkings:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
