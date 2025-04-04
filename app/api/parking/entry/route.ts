import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const supabase = createClient();
    const body = await req.json();
  
    const { license_plate, type, entry_time } = body;
  
    const { error } = await supabase.from("parked_vehicles").insert({
      license_plate,
      type,
      entry_time,  // Verificar que este valor sea un Date o que sea procesado correctamente.
    });
  
    if (error) {
      console.error("❌ Error al guardar entrada:", error);
      return NextResponse.json({ error }, { status: 500 });
    }
  
    return NextResponse.json({ success: true });
  }
  