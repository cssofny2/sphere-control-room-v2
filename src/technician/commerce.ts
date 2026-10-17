// Lunch carts, part requisitions and the order log.
//
// Nothing here spends money or contacts a seller. Dr. Wire builds a cart or a purchase requisition on his
// screen; the operator checks out on the real site, or approves the requisition. The log says exactly which.
import type { Page } from './desk';

export type OrderKind = 'cart' | 'requisition';
export type OrderStatus = 'cart-ready' | 'requisition-submitted' | 'declined';
export type Order = { id: string; kind: OrderKind; title: string; status: OrderStatus; createdAt: number; etaText?: string; etaISO?: string; url?: string; note: string };

// ——— dates ———
const isBiz = (d: Date) => d.getDay() !== 0 && d.getDay() !== 6;
/** Adds business days (Mon to Fri). An order placed after 15:00 or on a weekend counts from the next business day. */
export function addBusinessDays(from: Date, n: number): Date {
  const d = new Date(from.getTime());
  if (d.getHours() >= 15 || !isBiz(d)) { do { d.setDate(d.getDate() + 1); } while (!isBiz(d)); }
  let left = n; while (left > 0) { d.setDate(d.getDate() + 1); if (isBiz(d)) left--; }
  return d;
}
export const fmtDay = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
export type Eta = { days: number; date: Date; text: string };
export function etaFor(now: Date, urgent: boolean): Eta {
  const days = urgent ? 1 : 3; const date = addBusinessDays(now, days);
  return { days, date, text: `${fmtDay(date)} (${urgent ? 'expedited, next business day' : 'standard, about three business days'})` };
}

// ——— lunch ———
export type MenuItem = { name: string; kw: RegExp };
const MCD: MenuItem[] = [
  { name: 'Big Mac', kw: /big ?mac/i }, { name: 'McChicken', kw: /mc ?chicken/i }, { name: 'Quarter Pounder with Cheese', kw: /quarter ?pounder/i },
  { name: '10-piece Chicken McNuggets', kw: /nugget/i }, { name: 'Medium French Fries', kw: /fries|french/i }, { name: 'Medium Drink', kw: /coke|soda|drink|sprite|pepsi/i },
];
export type Cart = { place: string; items: string[]; url: string; assumed: boolean };
export function buildCart(place: string, request = ''): Cart {
  const isMcd = /mcdonald/i.test(place);
  if (isMcd) {
    const chosen = MCD.filter(m => m.kw.test(request)).map(m => m.name);
    const assumed = chosen.length === 0; const items = assumed ? ['Big Mac', 'Medium French Fries', 'Medium Drink'] : chosen;
    return { place: "McDonald's", items, url: 'https://www.doordash.com/search/store/mcdonalds/', assumed };
  }
  const slug = encodeURIComponent(place.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim());
  return { place, items: [], url: `https://www.doordash.com/search/store/${slug}/`, assumed: true };
}
export function cartPages(cart: Cart): { site: Page; cart: Page } {
  const isMcd = cart.place === "McDonald's";
  return {
    site: { kind: 'menu', title: `${cart.place} on DoorDash`, site: 'doordash.com', lines: isMcd ? ['Popular items', ...MCD.map(m => `  • ${m.name}`)] : [`Search: ${cart.place}`, 'Pick a nearby store and choose your items on DoorDash.'], footer: 'Preview built by Dr. Wire. Prices and availability are shown on DoorDash.' },
    cart: { kind: 'cart', title: 'Cart', site: 'doordash.com', lines: cart.items.length ? [...cart.items.map(i => `  1 × ${i}`), '', 'Delivery address and payment: you enter these on DoorDash.'] : ['No items chosen yet.', 'Open DoorDash to pick a store and items.'], footer: 'Not ordered yet. Use the Open DoorDash button to check out.' },
  };
}

// ——— parts ———
export type Requisition = { id: string; part: string; qty: number; urgent: boolean; eta: Eta };
export function buildRequisition(n: number, part: string, qty: number, urgent: boolean, now: Date): Requisition {
  return { id: `PR-${String(1000 + n)}`, part: part.trim().slice(0, 80), qty: Math.max(1, Math.min(99, Math.round(qty) || 1)), urgent, eta: etaFor(now, urgent) };
}
export function requisitionPages(r: Requisition): { catalog: Page; form: Page } {
  return {
    catalog: { kind: 'supplier', title: 'Parts catalog (lab purchasing)', site: 'lab purchasing', lines: [`Search: ${r.part}`, 'Matches are chosen by Dr. Wire from the request.', 'Part numbers are confirmed by purchasing.'], footer: 'Catalog preview. No supplier has been contacted.' },
    form: { kind: 'requisition', title: `Purchase requisition ${r.id}`, site: 'lab purchasing', lines: [`Item: ${r.part}`, `Quantity: ${r.qty}`, `Shipping: ${r.urgent ? 'expedited' : 'standard'}`, `Estimated arrival: ${r.eta.text}`, 'Status: waiting for approval'], footer: 'A requisition is a request to buy. Nothing is paid until purchasing approves it.' },
  };
}

// ——— the log ———
const KEY = 'sphere.technician.orders';
export type Store = { getItem(k: string): string | null; setItem(k: string, v: string): void };
export function createOrderLog(store?: Store | null) {
  let items: Order[] = []; const subs = new Set<() => void>();
  try { const raw = store?.getItem(KEY); if (raw) { const j = JSON.parse(raw); if (Array.isArray(j)) items = j.filter(o => o && typeof o.id === 'string').slice(-30); } } catch { /* storage may be blocked */ }
  const save = () => { try { store?.setItem(KEY, JSON.stringify(items.slice(-30))); } catch { /* ignore */ } subs.forEach(f => f()); };
  return {
    get items() { return items; },
    get nextNumber() { return items.filter(o => o.kind === 'requisition').length + 1; },
    add(o: Order) { items = [...items, o].slice(-30); save(); return o; },
    update(id: string, p: Partial<Order>) { items = items.map(o => (o.id === id ? { ...o, ...p } : o)); save(); },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export type OrderLog = ReturnType<typeof createOrderLog>;
