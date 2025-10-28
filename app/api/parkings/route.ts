import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isEstacionamientoAbierto, HorarioFranja } from "@/lib/types/horarios";

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

        // Obtener parámetro de filtro por tipo de vehículo
        const { searchParams } = new URL(request.url);
        const vehicleType = searchParams.get('vehicleType'); // AUT, MOT, CAM o null

        console.log('🔍 Obteniendo estacionamientos públicos para mapa...', vehicleType ? `Filtro: ${vehicleType}` : '');

        // Obtener estacionamientos que tengan coordenadas válidas Y estén publicados
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
                est_telefono,
                est_email,
                est_publicado,
                est_requiere_llave,
                est_descripcion,
                est_tolerancia_min
            `)
            .eq('est_publicado', true) // ✅ Solo estacionamientos públicos
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
                    let plazasQuery = supabase
                        .from('plazas')
                        .select('pla_estado, catv_segmento, plantilla_id')
                        .eq('est_id', parking.est_id);

                    // Filtrar por tipo de vehículo si se especifica
                    if (vehicleType) {
                        plazasQuery = plazasQuery.eq('catv_segmento', vehicleType);
                    }

                    // Consultar horarios del estacionamiento
                    const horariosQuery = supabase
                        .from('horarios_estacionamiento')
                        .select('*')
                        .eq('est_id', parking.est_id)
                        .order('dia_semana')
                        .order('orden');

                    const [{ data: plazasData, error: plazasError }, { data: horariosData, error: horariosError }] = await Promise.all([
                        plazasQuery,
                        horariosQuery
                    ]);

                    if (plazasError) {
                        console.error(`❌ Error obteniendo plazas para ${parking.est_id}:`, plazasError);
                        // Calcular estado de apertura con horarios
                        const horarios = (horariosData || []) as HorarioFranja[];
                        const estadoApertura = isEstacionamientoAbierto(horarios);

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
                            telefono: parking.est_telefono,
                            email: parking.est_email,
                            requiereLlave: parking.est_requiere_llave,
                            est_publicado: parking.est_publicado,
                            est_requiere_llave: parking.est_requiere_llave,
                            descripcion: parking.est_descripcion,
                            tolerancia: parking.est_tolerancia_min,
                            horarios: horarios,
                            estadoApertura: estadoApertura,
                            estado: parking.est_cantidad_espacios_disponibles > parking.est_capacidad * 0.5
                                ? 'disponible'
                                : parking.est_cantidad_espacios_disponibles > 0
                                    ? 'pocos'
                                    : 'lleno'
                        };
                    }

                    // Calcular disponibilidad real diferenciando plazas configuradas vs físicas
                    const totalFisico = plazasData?.length || 0;
                    const ocupadasFisicas = plazasData?.filter(p => p.pla_estado === 'Ocupada').length || 0;
                    const libresFisicos = totalFisico - ocupadasFisicas;

                    // Obtener plantillas y tarifas para plazas configuradas
                    const plantillaIds = [...new Set(plazasData?.map(p => p.plantilla_id).filter(Boolean) || [])];
                    let tarifasPorPlantilla: Record<number, number> = {};

                    if (plantillaIds.length > 0) {
                        const { data: tarifas, error: tarifasError } = await supabase
                            .from('tarifas')
                            .select('plantilla_id, tar_precio')
                            .in('plantilla_id', plantillaIds)
                            .lte('tar_f_desde', new Date().toISOString())
                            .order('tar_f_desde', { ascending: false });

                        if (!tarifasError && tarifas) {
                            // Tomar la tarifa más reciente para cada plantilla
                            tarifas.forEach(tarifa => {
                                if (!tarifasPorPlantilla[tarifa.plantilla_id]) {
                                    tarifasPorPlantilla[tarifa.plantilla_id] = tarifa.tar_precio;
                                }
                            });
                        }
                    }

                    // Calcular plazas libres configuradas (con plantilla y tarifa)
                    const plazasConfiguradas = plazasData?.filter(plaza =>
                        plaza.plantilla_id &&
                        tarifasPorPlantilla[plaza.plantilla_id] &&
                        plaza.pla_estado !== 'Ocupada' &&
                        plaza.pla_estado !== 'Mantenimiento' &&
                        plaza.pla_estado !== 'Abonado' &&
                        plaza.pla_estado !== 'Reservada'
                    ) || [];

                    const libresConfigurados = plazasConfiguradas.length;

                    // Determinar qué disponibilidad mostrar
                    let espaciosDisponibles: number;
                    let capacidad: number;
                    let tipoDisponibilidad: 'configurada' | 'fisica';

                    if (libresConfigurados > 0) {
                        // Si hay plazas configuradas libres, mostrar solo esas
                        espaciosDisponibles = libresConfigurados;
                        capacidad = plazasConfiguradas.length + plazasData?.filter(p => p.pla_estado === 'Ocupada' && p.plantilla_id && tarifasPorPlantilla[p.plantilla_id]).length || 0;
                        tipoDisponibilidad = 'configurada';
                    } else {
                        // Si no hay plazas configuradas libres, mostrar plazas físicas libres
                        espaciosDisponibles = libresFisicos;
                        capacidad = totalFisico;
                        tipoDisponibilidad = 'fisica';
                    }

                    // Si no hay plazas libres de ningún tipo, excluir el estacionamiento
                    if (espaciosDisponibles === 0) {
                        return null;
                    }

                    // Si se filtra por tipo, verificar que haya plazas disponibles de ese tipo
                    if (vehicleType) {
                        const plazasTipo = plazasData?.filter(p => p.catv_segmento === vehicleType) || [];
                        if (plazasTipo.length === 0) {
                            return null;
                        }

                        // Verificar disponibilidad del tipo específico
                        if (tipoDisponibilidad === 'configurada') {
                            const plazasConfiguradasTipo = plazasTipo.filter(p =>
                                p.plantilla_id && tarifasPorPlantilla[p.plantilla_id] &&
                                p.pla_estado !== 'Ocupada' && p.pla_estado !== 'Mantenimiento' &&
                                p.pla_estado !== 'Abonado' && p.pla_estado !== 'Reservada'
                            );
                            if (plazasConfiguradasTipo.length === 0) {
                                return null;
                            }
                        } else {
                            const libresTipo = plazasTipo.filter(p => p.pla_estado !== 'Ocupada').length;
                            if (libresTipo === 0) {
                                return null;
                            }
                        }
                    }

                    // Calcular estado de apertura con horarios
                    const horarios = (horariosData || []) as HorarioFranja[];
                    const estadoApertura = isEstacionamientoAbierto(horarios);

                    return {
                        id: parking.est_id,
                        nombre: parking.est_nombre,
                        direccion: parking.est_direc,
                        direccionCompleta: parking.est_direccion_completa || parking.est_direc,
                        localidad: parking.est_locali,
                        provincia: parking.est_prov,
                        latitud: parseFloat(parking.est_latitud),
                        longitud: parseFloat(parking.est_longitud),
                        capacidad: capacidad, // ✅ Capacidad según tipo de disponibilidad
                        espaciosDisponibles: espaciosDisponibles, // ✅ Disponibilidad diferenciada
                        telefono: parking.est_telefono,
                        email: parking.est_email,
                        requiereLlave: parking.est_requiere_llave,
                        est_publicado: parking.est_publicado,
                        est_requiere_llave: parking.est_requiere_llave,
                        descripcion: parking.est_descripcion,
                        tolerancia: parking.est_tolerancia_min,
                        horarios: horarios,
                        estadoApertura: estadoApertura,
                        tipoDisponibilidad: tipoDisponibilidad, // ✅ Nuevo: indica si es configurada o física
                        // Determinar estado basado en disponibilidad real
                        estado: espaciosDisponibles > capacidad * 0.5
                            ? 'disponible'
                            : espaciosDisponibles > 0
                                ? 'pocos'
                                : 'lleno'
                    };
                } catch (error) {
                    console.error(`❌ Error procesando estacionamiento ${parking.est_id}:`, error);
                    // Fallback en caso de error
                    const estadoAperturaFallback = { isOpen: false, hasSchedule: false };
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
                        telefono: parking.est_telefono,
                        email: parking.est_email,
                        requiereLlave: parking.est_requiere_llave,
                        est_publicado: parking.est_publicado,
                        est_requiere_llave: parking.est_requiere_llave,
                        descripcion: parking.est_descripcion,
                        tolerancia: parking.est_tolerancia_min,
                        horarios: [],
                        estadoApertura: estadoAperturaFallback,
                        tipoDisponibilidad: 'fisica' as const, // Fallback usa disponibilidad física
                        estado: 'disponible' // Estado por defecto
                    };
                }
            }) || []
        );

        // Filtrar nulls (estacionamientos sin plazas del tipo solicitado)
        const filteredParkings = parkingsForMap.filter(p => p !== null);

        return NextResponse.json({
            success: true,
            count: filteredParkings.length,
            parkings: filteredParkings,
            vehicleType: vehicleType || 'all'
        });

    } catch (error) {
        console.error('❌ Error en GET /api/parkings:', error);
        return NextResponse.json(
            { error: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
