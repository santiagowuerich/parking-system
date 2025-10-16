import { describe, test, expect } from 'vitest'
import { getAvailablePaymentMethods, formatCurrency, generatePaymentId, isPaymentExpired } from '@/lib/utils/payment-utils'
import { paymentConfigs } from '../../test-helpers'

describe('Payment Utils', () => {
    describe('getAvailablePaymentMethods', () => {
        test('returns only efectivo when no settings provided', () => {
            const result = getAvailablePaymentMethods()

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('efectivo')
        })

        test('returns only enabled payment methods', () => {
            const settings = {
                efectivo: { enabled: true },
                transfer: { enabled: false },
                mercadopago: { enabled: false }
            }

            const result = getAvailablePaymentMethods(settings)

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('efectivo')
        })

        test('returns multiple enabled methods', () => {
            const settings = {
                efectivo: { enabled: true },
                transfer: { enabled: true },
                mercadopago: { enabled: false }
            }

            const result = getAvailablePaymentMethods(settings)

            expect(result).toHaveLength(2)
            const methodIds = result.map(method => method.id)
            expect(methodIds).toContain('efectivo')
            expect(methodIds).toContain('transfer')
            expect(methodIds).not.toContain('mercadopago')
        })

        test('returns all methods when all enabled', () => {
            const settings = {
                efectivo: { enabled: true },
                transfer: { enabled: true },
                mercadopago: { enabled: true }
            }

            const result = getAvailablePaymentMethods(settings)

            expect(result).toHaveLength(3)
            const methodIds = result.map(method => method.id)
            expect(methodIds).toEqual(['efectivo', 'transfer', 'mercadopago'])
        })

        test('handles incomplete settings gracefully', () => {
            const settings = {
                efectivo: { enabled: true }
                // transfer y mercadopago no definidos
            } as any

            const result = getAvailablePaymentMethods(settings)

            expect(result).toHaveLength(1)
            expect(result[0].id).toBe('efectivo')
        })
    })

    describe('formatCurrency', () => {
        test('formats numbers as currency', () => {
            expect(formatCurrency(100)).toBe('$100')
            expect(formatCurrency(50.5)).toBe('$51') // Redondea
            expect(formatCurrency(0)).toBe('$0')
        })

        test('handles decimal numbers', () => {
            expect(formatCurrency(99.99)).toBe('$100') // Redondea hacia arriba
            expect(formatCurrency(99.49)).toBe('$99') // Redondea hacia abajo
        })
    })

    describe('generatePaymentId', () => {
        test('generates a payment ID', () => {
            const id = generatePaymentId()

            expect(typeof id).toBe('string')
            expect(id.length).toBeGreaterThan(0)
            expect(id).toMatch(/^PAY-\d{4}-\d{6}$/)
        })

        test('generates unique IDs', () => {
            const id1 = generatePaymentId()
            const id2 = generatePaymentId()

            expect(id1).not.toBe(id2)
        })
    })

    describe('isPaymentExpired', () => {
        test('returns true for expired dates', () => {
            const pastDate = new Date(Date.now() - 1000).toISOString()

            expect(isPaymentExpired(pastDate)).toBe(true)
        })

        test('returns false for future dates', () => {
            const futureDate = new Date(Date.now() + 3600000).toISOString() // +1 hora

            expect(isPaymentExpired(futureDate)).toBe(false)
        })

        test('returns false for null dates', () => {
            expect(isPaymentExpired(null)).toBe(false)
        })

        test('returns false for invalid dates', () => {
            expect(isPaymentExpired('invalid-date')).toBe(false)
        })
    })
})
