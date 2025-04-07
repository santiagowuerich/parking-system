import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const supabase = createClient();
  const userId = req.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("admins")
      .select("mercadopago_api_key")
      .eq("id", userId)
      .single();

    if (error) {
      // Si el error es porque no se encontró la fila, devolvemos un objeto vacío
      if (error.code === 'PGRST116') {
        return NextResponse.json({ mercadopagoApiKey: null });
      }
      console.error("Error fetching user settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ mercadopagoApiKey: data?.mercadopago_api_key || null });
  } catch (err) {
    console.error("Unexpected error fetching user settings:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { userId, mercadopagoApiKey } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }
  if (typeof mercadopagoApiKey !== 'string') {
    return NextResponse.json({ error: "mercadopagoApiKey must be a string" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("admins")
      .update({ mercadopago_api_key: mercadopagoApiKey })
      .eq("id", userId);

    if (error) {
      console.error("Error updating user settings:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "Settings updated successfully" });
  } catch (err) {
    console.error("Unexpected error updating user settings:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 