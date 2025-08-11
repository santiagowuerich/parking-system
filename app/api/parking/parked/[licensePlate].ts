import { supabase } from "@/lib/supabase";

export async function DELETE(req: Request, { params }: { params: Promise<{ licensePlate: string }> }) {
  const { licensePlate } = await params;

  try {
    const url = new URL(req.url)
    const estId = Number(url.searchParams.get('est_id')) || undefined
    const { error } = await supabase
      .from("ocupacion")
      .delete()
      .eq("veh_patente", licensePlate)
      .is("ocu_fh_salida", null)
      .eq(estId ? 'est_id' : 'veh_patente', estId ? estId : licensePlate) // pequeña compatibilidad para evitar condicional más largo

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ message: "Vehicle deleted successfully" }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}