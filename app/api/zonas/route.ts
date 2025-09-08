// app/api/zonas/route.ts - Sistema simplificado usando pla_zona
import { createClient } from "@/lib/supabase/client";
import { NextResponse, type NextRequest } from 'next/server'

// GET: Obtener zonas o información específica de una zona
export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request);

    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1
    const zonaNombre = url.searchParams.get('zona')

    try {
        // Si se especifica una zona, obtener información detallada de esa zona
        if (zonaNombre) {
            console.log(`🔍 Consultando información detallada de zona "${zonaNombre}"`);

            // Obtener todas las plazas de la zona
            const { data: plazas, error: plazasError } = await supabase
                .from('plazas')
                .select('*')
                .eq('est_id', estId)
                .eq('pla_zona', zonaNombre)
                .order('pla_numero');

            if (plazasError) {
                console.error('❌ Error obteniendo plazas de zona:', plazasError);
                return NextResponse.json({
                    error: `Error obteniendo plazas: ${plazasError.message}`
                }, { status: 500 });
            }

            if (!plazas || plazas.length === 0) {
                return NextResponse.json({
                    error: `No se encontraron plazas para la zona "${zonaNombre}"`
                }, { status: 404 });
            }

            // Calcular estadísticas de la zona
            const estadisticas = {
                total_plazas: plazas.length,
                plazas_libres: plazas.filter(p => p.pla_estado === 'Libre').length,
                plazas_ocupadas: plazas.filter(p => p.pla_estado === 'Ocupada').length,
                plazas_reservadas: plazas.filter(p => p.pla_estado === 'Reservada').length,
                plazas_mantenimiento: plazas.filter(p => p.pla_estado === 'Mantenimiento').length,
                numero_min: Math.min(...plazas.map(p => p.pla_numero)),
                numero_max: Math.max(...plazas.map(p => p.pla_numero))
            };

            // Intentar calcular filas y columnas (si hay patrón)
            let filas = 1;
            let columnas = plazas.length;

            // Si hay un patrón claro de filas/columnas, intentar detectarlo
            const posiblesColumnas = [5, 8, 10, 12, 15, 16, 20, 24, 25, 30];
            for (const cols of posiblesColumnas) {
                if (plazas.length % cols === 0) {
                    columnas = cols;
                    filas = plazas.length / cols;
                    break;
                }
            }

            const zonaInfo = {
                zona_nombre: zonaNombre,
                est_id: estId,
                total_plazas: plazas.length,
                filas_detectadas: filas,
                columnas_detectadas: columnas,
                estadisticas,
                plazas: plazas.map(p => ({
                    numero: p.pla_numero,
                    estado: p.pla_estado,
                    tipo_vehiculo: p.catv_segmento
                }))
            };

            console.log(`✅ Información de zona obtenida: ${plazas.length} plazas, ${filas}x${columnas} layout`);

            const json = NextResponse.json({
                success: true,
                zona: zonaInfo
            });

            response.cookies.getAll().forEach(c => {
                const { name, value, ...opt } = c;
                json.cookies.set({ name, value, ...opt })
            });
            return json;
        }

        // Si no se especifica zona, obtener todas las zonas únicas
        console.log('📊 Consultando todas las zonas disponibles');

        // Obtener zonas únicas del campo pla_zona (todas las plazas tienen zona obligatoria)
        const { data, error } = await supabase
            .from('plazas')
            .select('pla_zona')
            .eq('est_id', estId);

        if (error) {
            console.error('❌ Error consultando plazas:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Obtener zonas únicas (todas son válidas ya que pla_zona es NOT NULL)
        const plazasData = data || [];
        const zonasUnicas = [...new Set(plazasData.map(p => p.pla_zona))];

        const zonas = zonasUnicas.map((nombre, index) => ({
            id: index + 1,
            nombre: nombre,
            est_id: estId
        }));

        console.log('📊 Zonas encontradas:', { total: zonas.length, zonas: zonasUnicas });

        const json = NextResponse.json({ zonas });
        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('❌ Error en GET /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// POST: Crear zona nueva con generación automática de plazas
export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const body = await request.json();

        // Modo 1: Asignación manual de plazas existentes
        if (body.plaza_numeros && Array.isArray(body.plaza_numeros)) {
            const { zona_nombre, plaza_numeros, est_id } = body;

            if (!zona_nombre || !est_id) {
                return NextResponse.json({
                    error: 'Se requieren zona_nombre y est_id para asignación manual'
                }, { status: 400 });
            }

            // Actualizar las plazas con la nueva zona
            const { error } = await supabase
                .from('plazas')
                .update({ pla_zona: zona_nombre })
                .eq('est_id', est_id)
                .in('pla_numero', plaza_numeros);

            if (error) return NextResponse.json({ error: error.message }, { status: 500 });

            const json = NextResponse.json({
                success: true,
                message: `${plaza_numeros.length} plazas asignadas a la zona "${zona_nombre}"`
            });
            response.cookies.getAll().forEach(c => {
                const { name, value, ...opt } = c;
                json.cookies.set({ name, value, ...opt })
            });
            return json;
        }

        // Modo 2: Creación de zona con generación automática de plazas
        const { zona_nombre, est_id, capacidad } = body;

        if (!zona_nombre || !est_id || !capacidad) {
            return NextResponse.json({
                error: 'Se requieren zona_nombre, est_id y capacidad para crear zona con plazas'
            }, { status: 400 });
        }

        // Verificar que la zona no exista ya
        const { data: existingZones } = await supabase
            .from('plazas')
            .select('pla_zona')
            .eq('est_id', est_id)
            .eq('pla_zona', zona_nombre)
            .limit(1);

        if (existingZones && existingZones.length > 0) {
            return NextResponse.json({
                error: `La zona "${zona_nombre}" ya existe`
            }, { status: 400 });
        }

        // Obtener el número más alto de plaza existente
        const { data: existingPlazas } = await supabase
            .from('plazas')
            .select('pla_numero')
            .eq('est_id', est_id)
            .order('pla_numero', { ascending: false })
            .limit(1);

        let nextPlazaNumber = 1;
        if (existingPlazas && existingPlazas.length > 0) {
            nextPlazaNumber = (existingPlazas[0].pla_numero || 0) + 1;
        }

        // Generar plazas para cada tipo de vehículo
        const plazasToCreate = [];
        const tiposVehiculo = [
            { key: 'AUT', count: capacidad.Auto || 0 },
            { key: 'MOT', count: capacidad.Moto || 0 },
            { key: 'CAM', count: capacidad.Camioneta || 0 }
        ];

        let currentNumber = nextPlazaNumber;

        for (const tipo of tiposVehiculo) {
            for (let i = 0; i < tipo.count; i++) {
                plazasToCreate.push({
                    est_id: est_id,
                    pla_numero: currentNumber,
                    pla_estado: 'Libre',
                    catv_segmento: tipo.key,
                    pla_zona: zona_nombre
                });
                currentNumber++;
            }
        }

        // Insertar todas las plazas
        if (plazasToCreate.length > 0) {
            const { error: plazasError } = await supabase
                .from('plazas')
                .insert(plazasToCreate);

            if (plazasError) {
                console.error('❌ Error creando plazas:', plazasError);
                return NextResponse.json({
                    error: `Error creando plazas: ${plazasError.message}`
                }, { status: 500 });
            }
        }

        const totalPlazas = plazasToCreate.length;
        const plazaRange = totalPlazas > 0 ? `${nextPlazaNumber}-${currentNumber - 1}` : 'ninguna';

        const json = NextResponse.json({
            success: true,
            zona_nombre,
            plazas_creadas: totalPlazas,
            rango_plazas: plazaRange,
            message: `Zona "${zona_nombre}" creada con ${totalPlazas} plazas (${plazaRange})`
        });

        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('❌ Error en POST /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// PUT: Renombrar una zona
export async function PUT(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const { zona_antigua, zona_nueva, est_id } = await request.json();

        if (!zona_antigua || !zona_nueva || !est_id) {
            return NextResponse.json({
                error: 'Se requieren zona_antigua, zona_nueva y est_id'
            }, { status: 400 });
        }

        // Renombrar todas las plazas que tienen la zona antigua
        const { error } = await supabase
            .from('plazas')
            .update({ pla_zona: zona_nueva })
            .eq('est_id', est_id)
            .eq('pla_zona', zona_antigua);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const json = NextResponse.json({
            success: true,
            message: `Zona renombrada de "${zona_antigua}" a "${zona_nueva}"`
        });
        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('Error en PUT /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}

// DELETE: Eliminar una zona (reasignar plazas a GENERAL)
export async function DELETE(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const { zona_nombre, est_id } = await request.json();

        if (!zona_nombre || !est_id) {
            return NextResponse.json({
                error: 'Se requieren zona_nombre y est_id'
            }, { status: 400 });
        }

        // Verificar si hay más de una zona
        const { data: allZones } = await supabase
            .from('plazas')
            .select('pla_zona')
            .eq('est_id', est_id);

        const uniqueZones = [...new Set(allZones?.map(p => p.pla_zona) || [])];

        if (uniqueZones.length <= 1) {
            return NextResponse.json({
                error: 'No se puede eliminar la última zona. Todos los estacionamientos deben tener al menos una zona.'
            }, { status: 400 });
        }

        // Reasignar las plazas a zona "GENERAL" (zona por defecto)
        const { error } = await supabase
            .from('plazas')
            .update({ pla_zona: 'GENERAL' })
            .eq('est_id', est_id)
            .eq('pla_zona', zona_nombre);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const json = NextResponse.json({
            success: true,
            message: `Zona "${zona_nombre}" eliminada. Las plazas fueron reasignadas a zona "GENERAL".`
        });
        response.cookies.getAll().forEach(c => {
            const { name, value, ...opt } = c;
            json.cookies.set({ name, value, ...opt })
        });
        return json;

    } catch (err: any) {
        console.error('Error en DELETE /api/zonas:', err);
        return NextResponse.json({ error: err.message || 'Error interno del servidor' }, { status: 500 });
    }
}