"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Loader2, Search, Calendar as CalendarIcon } from "lucide-react";
import { formatArgentineTimeWithDayjs } from "@/lib/utils";
import { VehicleMovementsHistoryModal } from "@/components/vehicle-movements-history-modal";
import { toast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import dayjs from 'dayjs';

const ITEMS_PER_PAGE = 20;
const MOVEMENTS_FETCH_LIMIT = 500;

interface MovimientosTableProps {
    estId: number | null;
    showTitle?: boolean;
    showFilters?: boolean;
}

export function MovimientosTable({ estId, showTitle = true, showFilters = false }: MovimientosTableProps) {
    const [movements, setMovements] = useState<any[]>([]);
    const [filteredMovements, setFilteredMovements] = useState<any[]>([]);
    const [loadingMovements, setLoadingMovements] = useState(true);
    const [searchPatente, setSearchPatente] = useState("");
    const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
    const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
    const [selectedMovement, setSelectedMovement] = useState<{
        ocupacionId: number;
        licensePlate: string;
    } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (!estId) return;
        loadMovements();
    }, [estId]);

    // Aplicar filtros cuando cambien los criterios de búsqueda
    useEffect(() => {
        applyFilters();
    }, [searchPatente, dateFrom, dateTo, movements]);

    const loadMovements = async () => {
        if (!estId) return;

        setLoadingMovements(true);
        try {
            const response = await fetch(`/api/parking/movements?est_id=${estId}&limit=${MOVEMENTS_FETCH_LIMIT}`);
            const result = await response.json();

            if (result.success && result.data) {
                setMovements(result.data);
            } else {
                console.error('Error en respuesta:', result);
                setMovements([]);
            }
        } catch (error) {
            console.error('Error cargando movimientos:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "No se pudo cargar los movimientos"
            });
            setMovements([]);
        } finally {
            setLoadingMovements(false);
        }
    };

    const applyFilters = () => {
        let filtered = [...movements];

        // Filtrar por patente
        if (searchPatente.trim()) {
            filtered = filtered.filter(m =>
                m.license_plate?.toLowerCase().includes(searchPatente.toLowerCase())
            );
        }

        // Filtrar por fecha desde
        if (dateFrom) {
            const fromDate = dayjs(dateFrom).startOf('day');
            filtered = filtered.filter(m => {
                const movementDate = m.fecha_egreso
                    ? dayjs(m.fecha_egreso)
                    : dayjs(m.fecha_ingreso);
                return movementDate.isAfter(fromDate) || movementDate.isSame(fromDate, 'day');
            });
        }

        // Filtrar por fecha hasta
        if (dateTo) {
            const toDate = dayjs(dateTo).endOf('day');
            filtered = filtered.filter(m => {
                const movementDate = m.fecha_egreso
                    ? dayjs(m.fecha_egreso)
                    : dayjs(m.fecha_ingreso);
                return movementDate.isBefore(toDate) || movementDate.isSame(toDate, 'day');
            });
        }

        setFilteredMovements(filtered);
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSearchPatente("");
        setDateFrom(undefined);
        setDateTo(undefined);
        setCurrentPage(1);
    };

    const dataToDisplay = showFilters ? filteredMovements : movements;
    const totalPages = Math.max(1, Math.ceil(dataToDisplay.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageOffset = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedMovements = dataToDisplay.slice(pageOffset, pageOffset + ITEMS_PER_PAGE);

    useEffect(() => {
        if (currentPage !== safeCurrentPage) {
            setCurrentPage(safeCurrentPage);
        }
    }, [currentPage, safeCurrentPage]);

    return (
        <>
            <Card className="dark:bg-zinc-900 dark:border-zinc-800">
                {showTitle && (
                    <CardHeader>
                        <CardTitle className="dark:text-zinc-100">Movimientos</CardTitle>
                    </CardHeader>
                )}
                <CardContent className={showTitle ? "" : "pt-6"}>
                    {/* Filtros - Solo mostrar si showFilters es true */}
                    {showFilters && (
                        <div className="mb-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Búsqueda por patente */}
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        placeholder="Buscar por patente..."
                                        value={searchPatente}
                                        onChange={(e) => setSearchPatente(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>

                                {/* Fecha desde */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateFrom ? format(dateFrom, "PPP", { locale: es }) : "Fecha desde"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={dateFrom}
                                            onSelect={setDateFrom}
                                            initialFocus
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>

                                {/* Fecha hasta */}
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className="justify-start text-left font-normal"
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateTo ? format(dateTo, "PPP", { locale: es }) : "Fecha hasta"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={dateTo}
                                            onSelect={setDateTo}
                                            initialFocus
                                            locale={es}
                                        />
                                    </PopoverContent>
                                </Popover>

                                {/* Botón limpiar filtros */}
                                <Button
                                    variant="outline"
                                    onClick={clearFilters}
                                    disabled={!searchPatente && !dateFrom && !dateTo}
                                >
                                    Limpiar filtros
                                </Button>
                            </div>

                            {/* Indicador de filtros activos */}
                            {(searchPatente || dateFrom || dateTo) && (
                                <div className="text-sm text-gray-600">
                                    Mostrando {filteredMovements.length} de {movements.length} registros
                                </div>
                            )}
                        </div>
                    )}

                    {/* Tabla */}
                    <Table>
                        <TableHeader>
                            <TableRow className="dark:border-zinc-800">
                                <TableHead className="dark:text-zinc-400">Patente</TableHead>
                                <TableHead className="dark:text-zinc-400">Estado</TableHead>
                                <TableHead className="dark:text-zinc-400">Fecha Ingreso</TableHead>
                                <TableHead className="dark:text-zinc-400">Fecha Egreso</TableHead>
                                <TableHead className="dark:text-zinc-400">Zona</TableHead>
                                <TableHead className="dark:text-zinc-400">Plaza</TableHead>
                                <TableHead className="dark:text-zinc-400">Método</TableHead>
                                <TableHead className="dark:text-zinc-400">Tarifa</TableHead>
                                <TableHead className="text-right dark:text-zinc-400">Total</TableHead>
                                <TableHead className="dark:text-zinc-400">Movimientos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingMovements ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-zinc-400" />
                                    </TableCell>
                                </TableRow>
                            ) : (showFilters ? filteredMovements : movements).length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center py-8 text-zinc-500">
                                        {movements.length === 0
                                            ? "No hay movimientos registrados"
                                            : "No se encontraron movimientos con los filtros aplicados"}
                                    </TableCell>
                                </TableRow>
                            ) : paginatedMovements.map((movement, idx) => (
                                <TableRow key={pageOffset + idx} className="dark:border-zinc-800">
                                        <TableCell className="dark:text-zinc-100 font-medium">
                                            {movement.license_plate}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${movement.action === 'Ingreso' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <span className={`text-sm font-medium ${movement.action === 'Ingreso' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                    {movement.action}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="dark:text-zinc-100">
                                            {formatArgentineTimeWithDayjs(movement.fecha_ingreso)}
                                        </TableCell>
                                        <TableCell className="dark:text-zinc-100">
                                            {movement.fecha_egreso ? formatArgentineTimeWithDayjs(movement.fecha_egreso) : '-'}
                                        </TableCell>
                                        <TableCell className="dark:text-zinc-100">{movement.zona}</TableCell>
                                        <TableCell className="dark:text-zinc-100">{movement.plaza}</TableCell>
                                        <TableCell className="dark:text-zinc-100">{movement.method}</TableCell>
                                        <TableCell className="dark:text-zinc-100">{movement.tarifa || '$1200/h'}</TableCell>
                                        <TableCell className="text-right dark:text-zinc-100">{movement.total}</TableCell>
                                        <TableCell className="dark:text-zinc-100">
                                            {movement.movement_count > 0 ? (
                                                <button
                                                    onClick={() =>
                                                        setSelectedMovement({
                                                            ocupacionId: movement.ocu_id,
                                                            licensePlate: movement.license_plate,
                                                        })
                                                    }
                                                    className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                                >
                                                    Movimientos ({movement.movement_count})
                                                </button>
                                            ) : (
                                                <span className="text-gray-400 dark:text-gray-600 text-sm italic">
                                                    Sin movimientos
                                                </span>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                        </TableBody>
                    </Table>

                    {dataToDisplay.length > 0 && (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-4">
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                Mostrando {pageOffset + 1}-{Math.min(pageOffset + ITEMS_PER_PAGE, dataToDisplay.length)} de {dataToDisplay.length}
                            </span>
                            <div className="flex items-center gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={safeCurrentPage === 1}
                                >
                                    Anterior
                                </Button>
                                <span className="text-sm text-zinc-600 dark:text-zinc-300">
                                    Página {safeCurrentPage} de {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={safeCurrentPage === totalPages}
                                >
                                    Siguiente
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <VehicleMovementsHistoryModal
                isOpen={!!selectedMovement}
                onClose={() => setSelectedMovement(null)}
                ocupacionId={selectedMovement?.ocupacionId || null}
                licensePlate={selectedMovement?.licensePlate || ""}
            />
        </>
    );
}
