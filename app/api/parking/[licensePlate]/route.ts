import { supabase } from "@/lib/supabase";

export async function DELETE(req: Request, { params }: { params: Promise<{ licensePlate: string }> }) {
    const { licensePlate } = await params;

    console.log("DELETE request received for license plate:", licensePlate);

    try {
        const { data, error } = await supabase
            .from("ocupacion")
            .delete()
            .eq("veh_patente", licensePlate)
            .is("ocu_fh_salida", null);

        if (error) {
            console.error("Error deleting vehicle:", error);
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500 }
            );
        }

        console.log("Vehicle deleted successfully from database:", data);
        return new Response(
            JSON.stringify({ message: "Vehicle deleted successfully" }),
            { status: 200 }
        );
    } catch (err: any) {
        console.error("Error in DELETE function:", err);
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500 }
        );
    }
}