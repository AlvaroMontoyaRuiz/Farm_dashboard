// Shared facts about the feed (bultos).
//
// Types, in the order the animals go through them. To add a new type: add it here, in
// src/lib/format.js (label + color) and in the migration in migrate.js (the CHECK lists).
export const FOOD_TYPES = ['levante', 'engorde', 'finalizador'];

// IVA charged on top of the price of a bulto. Prices are stored WITHOUT IVA.
export const IVA_RATE = 0.05;

export const isFoodType = (t) => FOOD_TYPES.includes(t);
export const zeroByType = () => Object.fromEntries(FOOD_TYPES.map((t) => [t, 0]));

const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

// Cost of a purchase of `bultos` at `price` (sin IVA) each. Returns null when there is no price.
export function costOf(bultos, price) {
  if (price == null || !Number.isFinite(Number(price))) return null;
  const net = r2(Number(bultos) * Number(price));
  const iva = r2(net * IVA_RATE);
  return {
    priceNet: r2(price),
    priceIva: r2(Number(price) * IVA_RATE),
    priceGross: r2(Number(price) * (1 + IVA_RATE)),
    totalNet: net,
    totalIva: iva,
    totalGross: r2(net + iva),
  };
}
