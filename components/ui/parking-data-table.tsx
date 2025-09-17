import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

export interface Column {
    key: string;
    label: string;
    className?: string;
    hidden?: boolean;
}

export interface ActionButton {
    icon: React.ReactNode;
    onClick: (item: any) => void;
    title: string;
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    className?: string;
}

export interface ParkingDataTableProps {
    data: any[];
    columns: Column[];
    actions?: ActionButton[];
    emptyMessage?: string;
    className?: string;
}

export const ParkingDataTable: React.FC<ParkingDataTableProps> = ({
    data,
    columns,
    actions = [],
    emptyMessage = "No hay datos disponibles",
    className = ""
}) => {
    if (data.length === 0) {
        return (
            <p className="text-center text-gray-500 py-4 dark:text-zinc-500">
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className={`overflow-x-auto mt-4 ${className}`}>
            <Table>
                <TableHeader>
                    <TableRow className="dark:border-zinc-800">
                        {columns.map((column) => (
                            <TableHead
                                key={column.key}
                                className={`${column.className || ''} ${column.hidden ? 'hidden' : ''} dark:text-zinc-400`}
                            >
                                {column.label}
                            </TableHead>
                        ))}
                        {actions.length > 0 && (
                            <TableHead className="text-right dark:text-zinc-400">
                                Acciones
                            </TableHead>
                        )}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((item, index) => (
                        <TableRow key={item.id || `item-${index}`} className="dark:border-zinc-800">
                            {columns.map((column) => (
                                <TableCell
                                    key={column.key}
                                    className={`${column.hidden ? 'hidden' : ''} dark:text-zinc-100`}
                                >
                                    {item[column.key]}
                                </TableCell>
                            ))}
                            {actions.length > 0 && (
                                <TableCell className="text-right">
                                    <div className="flex gap-1 justify-end">
                                        {actions.map((action, actionIndex) => (
                                            <button
                                                key={actionIndex}
                                                onClick={() => action.onClick(item)}
                                                className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background ${action.variant === 'ghost'
                                                        ? 'hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2'
                                                        : action.variant === 'destructive'
                                                            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 px-4 py-2'
                                                            : 'bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2'
                                                    } ${action.className || ''}`}
                                                title={action.title}
                                            >
                                                {action.icon}
                                            </button>
                                        ))}
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
