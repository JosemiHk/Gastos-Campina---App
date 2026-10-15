export const MAX_RECEIPT_CENTS = 99_999_999;
const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
export function formatMoney(cents: number): string {
  return currency.format(cents / 100);
}
export function parseMoney(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,6}(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return cents > 0 && cents <= MAX_RECEIPT_CENTS ? cents : null;
}
export function monthNow(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  return `${parts.find((p) => p.type === 'year')!.value}-${parts.find((p) => p.type === 'month')!.value}-01`;
}
export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}T12:00:00Z`));
}
export function isMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])-01$/.test(value) && value >= '2020-01-01' && value <= '2100-12-01';
}
