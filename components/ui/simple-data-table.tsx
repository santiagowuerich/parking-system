import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export type TableColumn<T> = {
  header: ReactNode
  render: (item: T, index: number) => ReactNode
  headerClassName?: string
  cellClassName?: string
  key?: string
}

export interface SimpleDataTableProps<T> {
  data: T[]
  columns: TableColumn<T>[]
  getRowKey?: (item: T, index: number) => string | number
  emptyMessage?: ReactNode
  tableClassName?: string
  headerRowClassName?: string
  bodyRowClassName?: string | ((item: T, index: number) => string | undefined)
}

export function SimpleDataTable<T>({
  data,
  columns,
  getRowKey,
  emptyMessage = "No hay datos para mostrar",
  tableClassName,
  headerRowClassName,
  bodyRowClassName,
}: SimpleDataTableProps<T>) {
  if (data.length === 0) {
    return typeof emptyMessage === "string" ? (
      <p className="text-center text-gray-500 py-4 dark:text-zinc-500">{emptyMessage}</p>
    ) : (
      <>{emptyMessage}</>
    )
  }

  return (
    <Table className={tableClassName}>
      <TableHeader>
        <TableRow className={headerRowClassName}>
          {columns.map((column, index) => (
            <TableHead
              key={column.key ?? `header-${index}`}
              className={cn("text-left", column.headerClassName)}
            >
              {column.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item, index) => {
          const key = getRowKey?.(item, index) ?? index
          const rowClassName = typeof bodyRowClassName === "function"
            ? bodyRowClassName(item, index)
            : bodyRowClassName

          return (
            <TableRow key={key} className={rowClassName}>
              {columns.map((column, columnIndex) => (
                <TableCell
                  key={column.key ?? `cell-${columnIndex}`}
                  className={column.cellClassName}
                >
                  {column.render(item, index)}
                </TableCell>
              ))}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
