"use client";

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/use-toast'
import type { ExtensionState, AbonoData, TipoExtension } from '@/lib/types'
import { calculateNewExpiry } from '@/lib/utils/date-periods'

const TARJETA_INICIAL = { numero: '', vencimiento: '', cvv: '' }

export function useAbonoExtension(abono: AbonoData | null) {
    const { toast } = useToast()
    const [state, setState] = useState<ExtensionState>({
        tipoExtension: 'mensual',
        cantidad: 1,
        desde: '',
        nuevoVencimiento: '',
        metodoPago: 'efectivo',
        monto: 0,
        tarjeta: { ...TARJETA_INICIAL },
        loading: false,
        calculating: false,
    })

    // Reset state when the selected subscription changes
    useEffect(() => {
        if (!abono) {
            setState(prev => ({
                ...prev,
                desde: '',
                nuevoVencimiento: '',
                monto: 0,
                cantidad: 1,
                tipoExtension: 'mensual',
                metodoPago: 'efectivo',
                tarjeta: { ...TARJETA_INICIAL },
                calculating: false,
            }))
            return
        }

        const next = new Date(abono.fechaFinActual)
        next.setDate(next.getDate() + 1)
        const desde = next.toISOString().split('T')[0]

        const tipoNormalizado: TipoExtension = abono.tipoActual?.toLowerCase().includes('sem') ? 'semanal' : 'mensual'

        setState(prev => ({
            ...prev,
            tipoExtension: tipoNormalizado,
            cantidad: 1,
            desde,
            monto: 0,
            metodoPago: 'efectivo',
            tarjeta: { ...TARJETA_INICIAL },
            calculating: false,
        }))
    }, [abono?.abo_nro, abono?.fechaFinActual, abono?.tipoActual])

    // Recalculate expiry date when inputs change
    useEffect(() => {
        if (!state.desde || !state.tipoExtension) return
        const nuevoVencimiento = calculateNewExpiry(state.desde, state.tipoExtension, state.cantidad)
        setState(prev => ({ ...prev, nuevoVencimiento }))
    }, [state.desde, state.tipoExtension, state.cantidad])

    // Fetch price per period from backend
    useEffect(() => {
        const fetchPrice = async () => {
            if (!abono) {
                setState(prev => ({ ...prev, monto: 0, calculating: false }))
                return
            }

            setState(prev => ({ ...prev, calculating: true }))
            try {
                const res = await fetch(`/api/abonos/period-price?abo_nro=${abono.abo_nro}&tipo=${state.tipoExtension}`)
                if (!res.ok) throw new Error('No se pudo obtener precio')
                const data = await res.json()
                setState(prev => ({
                    ...prev,
                    monto: Number(data.precioPorPeriodo) * prev.cantidad,
                    calculating: false,
                }))
            } catch (error) {
                console.error(error)
                toast({ title: 'Error', description: 'No se pudo calcular el precio', variant: 'destructive' })
                setState(prev => ({ ...prev, calculating: false, monto: 0 }))
            }
        }
        fetchPrice()
    }, [abono?.abo_nro, state.tipoExtension, state.cantidad])

    const setTipoExtension = (tipo: TipoExtension) =>
        setState(prev => ({ ...prev, tipoExtension: tipo }))

    const setCantidad = (cantidad: number) =>
        setState(prev => ({ ...prev, cantidad: Math.max(1, cantidad || 1) }))

    const setDesde = (desde: string) => setState(prev => ({ ...prev, desde }))

    const setMetodoPago = (metodo: 'efectivo' | 'tarjeta' | 'transferencia') =>
        setState(prev => ({ ...prev, metodoPago: metodo }))

    const setTarjeta = (tarjeta: { numero: string; vencimiento: string; cvv: string }) =>
        setState(prev => ({ ...prev, tarjeta }))

    const isValid = (): boolean => {
        if (!abono) return false
        if (!state.tipoExtension || !state.cantidad || !state.desde || !state.nuevoVencimiento) return false
        if (state.metodoPago === 'tarjeta') {
            return Boolean(state.tarjeta.numero && state.tarjeta.vencimiento && state.tarjeta.cvv)
        }
        return true
    }

    const submit = async () => {
        if (!abono) return
        if (!isValid()) {
            toast({ title: 'Datos incompletos', description: 'Complete los campos requeridos', variant: 'destructive' })
            return
        }

        setState(prev => ({ ...prev, loading: true }))
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
                    tarjeta: state.metodoPago === 'tarjeta' ? state.tarjeta : undefined,
                }),
            })

            if (!res.ok) {
                const errorPayload = await res.json().catch(() => ({}))
                throw new Error(errorPayload?.error || 'Error al extender')
            }

            toast({ title: 'Extension confirmada', description: 'El abono fue extendido correctamente' })
            return await res.json()
        } catch (error: any) {
            console.error(error)
            toast({ title: 'Error', description: error.message || 'No se pudo extender', variant: 'destructive' })
            throw error
        } finally {
            setState(prev => ({ ...prev, loading: false }))
        }
    }

    return {
        state,
        setTipoExtension,
        setCantidad,
        setDesde,
        setMetodoPago,
        setTarjeta,
        isValid,
        submit,
    }
}
