// Utilidades de fechas para extensiones de abonos

export type PeriodType = 'mensual' | 'bimestral' | 'trimestral' | 'anual'

export function addMonths(date: Date, months: number): Date {
    const d = new Date(date)
    const targetMonth = d.getMonth() + months
    const yearsToAdd = Math.floor(targetMonth / 12)
    const month = ((targetMonth % 12) + 12) % 12
    d.setFullYear(d.getFullYear() + yearsToAdd)
    d.setMonth(month)
    return d
}

export function addDays(date: Date | string, days: number): Date {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    return d
}

export function calculateNewExpiry(
    startDate: string,
    period: PeriodType,
    quantity: number
): string {
    const start = new Date(startDate)
    switch (period) {
        case 'mensual':
            return addMonths(start, quantity).toISOString().split('T')[0]
        case 'bimestral':
            return addMonths(start, quantity * 2).toISOString().split('T')[0]
        case 'trimestral':
            return addMonths(start, quantity * 3).toISOString().split('T')[0]
        case 'anual':
            return addMonths(start, quantity * 12).toISOString().split('T')[0]
        default:
            return start.toISOString().split('T')[0]
    }
}


