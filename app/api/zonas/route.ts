// app/api/zonas/route.ts - Sistema simplificado usando pla_zona
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// GET: Obtener todas las zonas únicas de un estacionamiento
export async function GET(request: NextRequest) {
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name) => request.cookies.get(name)?.value,
                set: (name, value, options) => response.cookies.set({ name, value, ...options }),
                remove: (name, options) => response.cookies.set({ name, value: '', ...options })
            }
        }
    )

    const url = new URL(request.url)
    const estId = Number(url.searchParams.get('est_id')) || 1

    try {
        // Obtener zonas únicas del campo pla_zona
        const { data, error } = await supabase
            .from('plazas')
            .select('pla_zona')
            .eq('est_id', estId)
            .not('pla_zona', 'is', null);

        if (error) {
            console.error('❌ Error consultando plazas:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Obtener zonas únicas y filtrar valores válidos
        const plazasData = data || [];
        const zonasUnicas = [...new Set(plazasData.map(p => p.pla_zona))]
            .filter(zona => zona && zona.trim() !== '');

        const zonas = zonasUnicas.map((nombre, index) => ({
            id: index + 1,
            nombre: nombre,
            est_id: estId
        }));

        console.log('📊 Zonas encontradas:', { plazasData: plazasData.length, zonasUnicas, zonas });

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
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name) => request.cookies.get(name)?.value,
                set: (name, value, options) => response.cookies.set({ name, value, ...options }),
                remove: (name, options) => response.cookies.set({ name, value: '', ...options })
            }
        }
    )

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
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name) => request.cookies.get(name)?.value,
                set: (name, value, options) => response.cookies.set({ name, value, ...options }),
                remove: (name, options) => response.cookies.set({ name, value: '', ...options })
            }
        }
    )

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

// DELETE: Eliminar una zona (poner plazas en null)
export async function DELETE(request: NextRequest) {
    let response = NextResponse.next()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name) => request.cookies.get(name)?.value,
                set: (name, value, options) => response.cookies.set({ name, value: '', ...options }),
                remove: (name, options) => response.cookies.set({ name, value: '', ...options })
            }
        }
    )

    try {
        const { zona_nombre, est_id } = await request.json();

        if (!zona_nombre || !est_id) {
            return NextResponse.json({
                error: 'Se requieren zona_nombre y est_id'
            }, { status: 400 });
        }

        // Poner las plazas de esa zona en null (sin zona)
        const { error } = await supabase
            .from('plazas')
            .update({ pla_zona: null })
            .eq('est_id', est_id)
            .eq('pla_zona', zona_nombre);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });

        const json = NextResponse.json({
            success: true,
            message: `Zona "${zona_nombre}" eliminada. Las plazas quedaron sin zona asignada.`
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