"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ReporteHeader } from "../../reporte-header";
import { PieChart } from "lucide-react";
import { DateRange } from "react-day-picker";

export function RentabilidadReporte() {
    const [dateRange, setDateRange] = useState<DateRange | undefined>();

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <ReporteHeader
                title=""
                dateRange={dateRange}
                onDateRangeChange={setDateRange}
                showPrintButton={false}
            />

            {/* Contenido placeholder */}
            <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                    <PieChart className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        Reporte en construcción
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                        Este reporte mostrará ROI por zona, tipo de vehículo y franja horaria.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
