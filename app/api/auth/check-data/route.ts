import { createClient, copyResponseCookies } from "@/lib/supabase/client";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email");

  if (!email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const { supabase, response } = createClient(request);

    // Buscar registros en las tablas principales
    const [parkedVehicles, history, capacity] = await Promise.all([
      supabase
        .from("parked_vehicles")
        .select("user_id")
        .eq("email", email)
        .limit(1)
        .single(),
      supabase
        .from("parking_history")
        .select("user_id")
        .eq("email", email)
        .limit(1)
        .single(),
      supabase
        .from("user_capacity")
        .select("user_id")
        .eq("email", email)
        .limit(1)
        .single(),
    ]);

    const oldUserId =
      parkedVehicles?.data?.user_id ||
      history?.data?.user_id ||
      capacity?.data?.user_id;

    const jsonResponse = NextResponse.json({
      hasData: Boolean(oldUserId),
      oldUserId,
    });
    return copyResponseCookies(response, jsonResponse);
  } catch (error: any) {
    console.error("Error checking user data:", error);
    return NextResponse.json(
      { error: "Error checking user data" },
      { status: 500 }
    );
  }
} 