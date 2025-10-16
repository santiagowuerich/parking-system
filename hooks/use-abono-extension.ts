"use client";

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { ExtensionState, AbonoData, TipoExtension } from '@/lib/types'
import { calculateNewExpiry } from '@/lib/utils/date-periods'

export function useAbonoExtension(abono: AbonoData | null) {
    const { toast } = useToast()
    const [state, setState] = useState<ExtensionState>({
        tipoExtension: 'mensual',
        cantidad: 1,
        desde: '',
        nuevoVencimiento: '',
        metodoPago: 'efectivo',
        monto: 0,
        nota: '',
        tarjeta: { numero: '', vencimiento: '', cvv: '' },
        loading: false,
        calculating: false
    })

    // Inicializar "desde" = día siguiente al vencimiento actual
    useEffect(() => {
        if (!abono) return
        const next = new Date(abono.fechaFinActual)
        next.setDate(next.getDate() + 1)
        setState(prev => ({ ...prev, desde: next.toISOString().split('T')[0] }))
    }, [abono?.fechaFinActual])

    // Recalcular vencimiento
    useEffect(() => {
        if (!state.desde) return
        const nv = calculateNewExpiry(state.desde, state.tipoExtension, state.cantidad)
        setState(prev => ({ ...prev, nuevoVencimiento: nv }))
    }, [state.desde, state.tipoExtension, state.cantidad])

    // Consultar precio por período en backend
    useEffect(() => {
        const fetchPrice = async () => {
            if (!abono) return
            setState(prev => ({ ...prev, calculating: true }))
            try {
                const res = await fetch(`/api/abonos/period-price?abo_nro=${abono.abo_nro}&tipo=${state.tipoExtension}`)
                if (!res.ok) throw new Error('No se pudo obtener precio')
                const data = await res.json()
                setState(prev => ({ ...prev, monto: Number(data.precioPorPeriodo) * prev.cantidad, calculating: false }))
            } catch (e: any) {
                console.error(e)
                toast({ title: 'Error', description: 'No se pudo calcular el precio', variant: 'destructive' })
                setState(prev => ({ ...prev, calculating: false }))
            }
        }
        fetchPrice()
    }, [abono?.abo_nro, state.tipoExtension, state.cantidad])

    const setTipoExtension = (tipo: TipoExtension) => setState(p => ({ ...p, tipoExtension: tipo }))
    const setCantidad = (c: number) => setState(p => ({ ...p, cantidad: Math.max(1, c || 1) }))
    const setDesde = (d: string) => setState(p => ({ ...p, desde: d }))
    const setMetodoPago = (m: 'efectivo' | 'tarjeta' | 'transferencia') => setState(p => ({ ...p, metodoPago: m }))
    const setNota = (n: string) => setState(p => ({ ...p, nota: n }))
    const setTarjeta = (t: { numero: string; vencimiento: string; cvv: string }) => setState(p => ({ ...p, tarjeta: t }))

    const isValid = (): boolean => {
        if (!abono) return false
        if (!state.tipoExtension || !state.cantidad || !state.desde || !state.nuevoVencimiento) return false
        if (state.metodoPago === 'tarjeta') {
            return !!(state.tarjeta.numero && state.tarjeta.vencimiento && state.tarjeta.cvv)
        }
        return true
    }

    const submit = async () => {
        if (!abono) return
        if (!isValid()) {
            toast({ title: 'Datos incompletos', description: 'Complete los campos requeridos', variant: 'destructive' })
            return
        }
        setState(p => ({ ...p, loading: true }))
        try {
            const res = await fetch('/api/abonos/extender', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    abo_nro: abono.abo_nro,
                    tipoExtension: state.tipoExtension,
                    cantidad: state.cantidad,
                    nuevoVencimiento: state.nuevoVencimiento,
                    metodoPago: state.metodoPago,
                    monto: state.monto,
                    nota: state.nota,
                    tarjeta: state.metodoPago === 'tarjeta' ? state.tarjeta : undefined
                })
            })
            if (!res.ok) throw new Error((await res.json())?.error || 'Error al extender')
            toast({ title: 'Extensión confirmada', description: 'El abono fue extendido correctamente' })
            return await res.json()
        } catch (e: any) {
            console.error(e)
            toast({ title: 'Error', description: e.message || 'No se pudo extender', variant: 'destructive' })
            throw e
        } finally {
            setState(p => ({ ...p, loading: false }))
        }
    }

    return {
        state,
        setTipoExtension,
        setCantidad,
        setDesde,
        setMetodoPago,
        setNota,
        setTarjeta,
        isValid,
        submit
    }
}


