import { NextRequest, NextResponse } from "next/server";
import { createClient, copyResponseCookies } from "@/lib/supabase/client";

type SupabaseClient = ReturnType<typeof createClient>["supabase"];

const tipoToSegmento: Record<string, string> = {
    Auto: "AUT",
    Moto: "MOT",
    Camioneta: "CAM",
};

const segmentoToTipo: Record<string, string> = {
    AUT: "Auto",
    MOT: "Moto",
    CAM: "Camioneta",
};

async function obtenerContextoAbono(supabase: SupabaseClient, abo_nro: number) {
    return supabase
        .from("abonos")
        .select("abo_nro, est_id, pla_numero, abonado(con_id), plazas(catv_segmento)")
        .eq("abo_nro", abo_nro)
        .maybeSingle();
}

async function obtenerVehiculosData(supabase: SupabaseClient, abo_nro: number, est_id: number, con_id: number) {
    const [{ data: vehiculosAbono, error: vehiculosAbonoError }, { data: vehiculosConductor, error: vehiculosConductorError }] =
        await Promise.all([
            supabase
                .from("vehiculos_abonados")
                .select("veh_patente, vehiculos(veh_marca, veh_modelo, veh_color, catv_segmento)")
                .eq("abo_nro", abo_nro)
                .eq("est_id", est_id),
            supabase
                .from("vehiculos")
                .select("veh_patente, veh_marca, veh_modelo, veh_color, catv_segmento")
                .eq("con_id", con_id),
        ]);

    if (vehiculosAbonoError) {
        console.error("Error obteniendo vehiculos asociados:", vehiculosAbonoError);
    }

    if (vehiculosConductorError) {
        console.error("Error obteniendo vehiculos del conductor:", vehiculosConductorError);
    }

    return {
        vehiculosAbono: vehiculosAbono || [],
        vehiculosConductor: vehiculosConductor || [],
    };
}

export async function GET(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const { searchParams } = new URL(request.url);
        const abo_nro = Number(searchParams.get("abo_nro"));

        if (!abo_nro) {
            return NextResponse.json({ success: false, error: "abo_nro requerido" }, { status: 400 });
        }

        const { data: abono, error } = await obtenerContextoAbono(supabase, abo_nro);

        if (error || !abono) {
            console.error("Error obteniendo contexto de abono:", error);
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Abono no encontrado" }, { status: 404 }));
        }

        const est_id = abono.est_id;
        const con_id = abono.abonado?.con_id;

        if (!con_id) {
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Conductor no asociado al abono" }, { status: 400 }));
        }

        const data = await obtenerVehiculosData(supabase, abo_nro, est_id, con_id);

        // Obtener información de la plaza del abono
        const plaza = Array.isArray(abono.plazas) ? abono.plazas[0] : abono.plazas;
        const plazaCatvSegmento = plaza?.catv_segmento || null;

        return copyResponseCookies(
            response,
            NextResponse.json({
                success: true,
                data: {
                    ...data,
                    est_id,
                    con_id,
                    plaza_catv_segmento: plazaCatvSegmento,
                },
            }),
        );
    } catch (err) {
        console.error("Error en GET /api/abonos/vehiculos:", err);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}

interface PostBody {
    abo_nro: number;
    mode: "existing" | "new";
    patente?: string;
    vehiculo?: {
        patente: string;
        tipo: "Auto" | "Moto" | "Camioneta";
        marca?: string;
        modelo?: string;
        color?: string;
    };
}

export async function POST(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const body = (await request.json()) as PostBody;
        const { abo_nro, mode } = body;

        if (!abo_nro || !mode) {
            return NextResponse.json({ success: false, error: "Datos insuficientes" }, { status: 400 });
        }

        const { data: abono, error } = await obtenerContextoAbono(supabase, abo_nro);

        if (error || !abono) {
            console.error("Error obteniendo contexto de abono:", error);
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Abono no encontrado" }, { status: 404 }));
        }

        const est_id = abono.est_id;
        const con_id = abono.abonado?.con_id;

        if (!con_id) {
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Conductor no asociado al abono" }, { status: 400 }));
        }

        if (mode === "existing") {
            const patente = body.patente?.toUpperCase();

            if (!patente) {
                return copyResponseCookies(response, NextResponse.json({ success: false, error: "Patente requerida" }, { status: 400 }));
            }

            const { data: vehiculo, error: vehiculoError } = await supabase
                .from("vehiculos")
                .select("veh_patente, con_id")
                .eq("veh_patente", patente)
                .maybeSingle();

            if (vehiculoError || !vehiculo || vehiculo.con_id !== con_id) {
                return copyResponseCookies(
                    response,
                    NextResponse.json({ success: false, error: "El vehiculo no pertenece al conductor" }, { status: 400 }),
                );
            }

            const { data: existente } = await supabase
                .from("vehiculos_abonados")
                .select("veh_patente")
                .eq("abo_nro", abo_nro)
                .eq("veh_patente", patente)
                .maybeSingle();

            if (existente) {
                return copyResponseCookies(
                    response,
                    NextResponse.json({ success: false, error: "El vehiculo ya esta asociado al abono" }, { status: 409 }),
                );
            }

            const { error: insercionError } = await supabase.from("vehiculos_abonados").insert({
                est_id,
                abo_nro,
                veh_patente: patente,
            });

            if (insercionError) {
                console.error("Error asociando vehiculo existente:", insercionError);
                return copyResponseCookies(response, NextResponse.json({ success: false, error: "No se pudo asociar el vehiculo" }, { status: 500 }));
            }
        } else if (mode === "new") {
            const vehiculo = body.vehiculo;

            if (!vehiculo) {
                return copyResponseCookies(response, NextResponse.json({ success: false, error: "Datos de vehiculo requeridos" }, { status: 400 }));
            }

            const patente = vehiculo.patente?.toUpperCase();

            if (!patente) {
                return copyResponseCookies(response, NextResponse.json({ success: false, error: "Patente requerida" }, { status: 400 }));
            }

            const segmento = tipoToSegmento[vehiculo.tipo] || "AUT";

            const { data: vehiculoExistente } = await supabase
                .from("vehiculos")
                .select("veh_patente, con_id")
                .eq("veh_patente", patente)
                .maybeSingle();

            if (vehiculoExistente && vehiculoExistente.con_id && vehiculoExistente.con_id !== con_id) {
                return copyResponseCookies(
                    response,
                    NextResponse.json({ success: false, error: "La patente pertenece a otro conductor" }, { status: 409 }),
                );
            }

            const { error: vehiculoError } = await supabase.from("vehiculos").upsert(
                {
                    veh_patente: patente,
                    con_id,
                    catv_segmento: segmento,
                    veh_marca: vehiculo.marca || null,
                    veh_modelo: vehiculo.modelo || null,
                    veh_color: vehiculo.color || null,
                },
                { onConflict: "veh_patente" },
            );

            if (vehiculoError) {
                console.error("Error registrando vehiculo:", vehiculoError);
                return copyResponseCookies(
                    response,
                    NextResponse.json({ success: false, error: "No se pudo registrar el vehiculo" }, { status: 500 }),
                );
            }

            const { error: asociacionError } = await supabase.from("vehiculos_abonados").insert({
                est_id,
                abo_nro,
                veh_patente: patente,
            });

            if (asociacionError) {
                console.error("Error asociando nuevo vehiculo:", asociacionError);
                return copyResponseCookies(response, NextResponse.json({ success: false, error: "No se pudo asociar el vehiculo" }, { status: 500 }));
            }
        } else {
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Modo invalido" }, { status: 400 }));
        }

        const data = await obtenerVehiculosData(supabase, abo_nro, est_id, con_id);

        const vehiculosNormalizados = data.vehiculosAbono.map((item) => ({
            ...item,
            vehiculos: item.vehiculos
                ? {
                      ...item.vehiculos,
                      tipo: segmentoToTipo[item.vehiculos.catv_segmento] || "Auto",
                  }
                : null,
        }));

        // Obtener información de la plaza del abono
        const plaza = Array.isArray(abono.plazas) ? abono.plazas[0] : abono.plazas;
        const plazaCatvSegmento = plaza?.catv_segmento || null;

        return copyResponseCookies(
            response,
            NextResponse.json({
                success: true,
                data: {
                    vehiculosAbono: vehiculosNormalizados,
                    vehiculosConductor: data.vehiculosConductor,
                    plaza_catv_segmento: plazaCatvSegmento,
                },
            }),
        );
    } catch (err) {
        console.error("Error en POST /api/abonos/vehiculos:", err);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}

interface DeleteBody {
    abo_nro: number;
    patente: string;
}

export async function DELETE(request: NextRequest) {
    const { supabase, response } = createClient(request);

    try {
        const body = (await request.json()) as DeleteBody;
        const { abo_nro, patente } = body;

        if (!abo_nro || !patente) {
            return NextResponse.json({ success: false, error: "Datos insuficientes" }, { status: 400 });
        }

        const { data: abono, error } = await obtenerContextoAbono(supabase, abo_nro);

        if (error || !abono) {
            console.error("Error obteniendo contexto de abono:", error);
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Abono no encontrado" }, { status: 404 }));
        }

        const est_id = abono.est_id;
        const con_id = abono.abonado?.con_id;

        if (!con_id) {
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "Conductor no asociado al abono" }, { status: 400 }));
        }

        const { error: deleteError } = await supabase
            .from("vehiculos_abonados")
            .delete()
            .eq("abo_nro", abo_nro)
            .eq("veh_patente", patente.toUpperCase())
            .eq("est_id", est_id);

        if (deleteError) {
            console.error("Error eliminando vehiculo del abono:", deleteError);
            return copyResponseCookies(response, NextResponse.json({ success: false, error: "No se pudo quitar el vehiculo" }, { status: 500 }));
        }

        const data = await obtenerVehiculosData(supabase, abo_nro, est_id, con_id);

        // Obtener información de la plaza del abono
        const plaza = Array.isArray(abono.plazas) ? abono.plazas[0] : abono.plazas;
        const plazaCatvSegmento = plaza?.catv_segmento || null;

        return copyResponseCookies(
            response,
            NextResponse.json({
                success: true,
                data: {
                    ...data,
                    plaza_catv_segmento: plazaCatvSegmento,
                },
            }),
        );
    } catch (err) {
        console.error("Error en DELETE /api/abonos/vehiculos:", err);
        return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
    }
}
