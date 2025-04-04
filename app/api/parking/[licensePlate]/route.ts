import { supabase } from "@/lib/supabase";

export async function DELETE(req: Request, { params }: { params: { licensePlate: string } }) {
    const { licensePlate } = params;

    console.log("DELETE request received for license plate:", licensePlate);

    try {
        const { data, error } = await supabase
            .from("parked_vehicles")
            .delete()
            .eq("license_plate", licensePlate);

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