const CENTS_PER_UNIT = 100;

export function toCents(amount: string): number { 
    const normalized = amount.replace(',', '.').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
        throw new Error(`Valor monetário inválido: ${amount}`);
}
return Math.round(Number(normalized) * CENTS_PER_UNIT);
}

export function formatCents(cents: number): string { 
    return (cents / CENTS_PER_UNIT).toLocaleString('pt-BR', { 
        style: 'currency',
        currency: 'BRL',
    })
}