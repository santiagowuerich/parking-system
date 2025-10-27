"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, Printer, Download } from "lucide-react";
import { DateRange } from "react-day-picker";

interface ReporteHeaderProps {
    title: string;
    subtitle?: string;
    dateRange?: DateRange;
    onDateRangeChange?: (range: DateRange | undefined) => void;
    onPrint?: () => void;
    onExport?: () => void;
    showDateFilter?: boolean;
    showPrintButton?: boolean;
    showExportButton?: boolean;
}

export function ReporteHeader({
    title,
    subtitle,
    dateRange,
    onDateRangeChange,
    onPrint,
    onExport,
    showDateFilter = true,
    showPrintButton = true,
    showExportButton = false
}: ReporteHeaderProps) {
    return (
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-start">
            <div className="flex flex-wrap gap-2">
                {showDateFilter && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "dd MMM", { locale: es })} -{" "}
                                            {format(dateRange.to, "dd MMM yyyy", { locale: es })}
                                        </>
                                    ) : (
                                        format(dateRange.from, "dd MMM yyyy", { locale: es })
                                    )
                                ) : (
                                    <span>Seleccionar período</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={onDateRangeChange}
                                numberOfMonths={2}
                                locale={es}
                            />
                        </PopoverContent>
                    </Popover>
                )}

                {showExportButton && onExport && (
                    <Button
                        variant="outline"
                        onClick={onExport}
                        className="gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Exportar
                    </Button>
                )}

                {showPrintButton && (
                    <Button
                        variant="outline"
                        onClick={onPrint || (() => window.print())}
                        className="gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        Imprimir
                    </Button>
                )}
            </div>
        </div>
    );
}
