import { supabase } from "@/lib/supabase";

export async function DELETE(req: Request, { params }: { params: Promise<{ licensePlate: string }> }) {
  const { licensePlate } = await params;

  try {
    const { error } = await supabase
      .from("parked_vehicles")
      .delete()
      .match({ license_plate: licensePlate });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ message: "Vehicle deleted successfully" }), { status: 200 });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}