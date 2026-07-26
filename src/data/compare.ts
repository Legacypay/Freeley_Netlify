// Single source of truth for the Freeley-vs-the-rest comparison.
//
// Two surfaces read this: the capsule on /preview shows only the `hero` rows —
// Freeley's own value, no competitors — and /compare renders the full grid.
// They were duplicated arrays for about ten minutes, which is exactly how the
// two drift apart, so they live here instead.
//
// `cells` is index-aligned with `compareCols`; Freeley is always index 0.
// 'y' and 'n' render as icons, anything else renders as literal text.

export const compareCols = ['Freeley', 'Traditional Clinics', 'Retail Pharmacy', 'Other Telehealth'];

export type CompareRow = { label: string; cells: string[]; hero?: boolean };

export const compareRows: CompareRow[] = [
  { label: 'Board-certified physician oversight', cells: ['y', 'y', '–', 'Varies'] },
  { label: 'No in-person visit required', cells: ['y', 'n', 'n', 'y'], hero: true },
  { label: 'Compounded medication options', cells: ['y', 'Rarely', 'n', 'Some'] },
  { label: 'Monthly price (GLP-1 weight loss)', cells: ['$99/mo · 12-mo plan', '$300–$500+', 'Varies', '$188–$399'], hero: true },
  { label: 'Free shipping & discreet delivery', cells: ['y', 'n', 'Varies', 'y'], hero: true },
  { label: 'FSA / HSA eligible', cells: ['y', 'y', 'y', 'Some'], hero: true },
  { label: 'No membership or hidden fees', cells: ['y', 'n', 'y', 'Varies'] },
  { label: 'Cancel anytime — no contracts', cells: ['y', 'N/A', 'N/A', 'Varies'] },
];

/** The four the capsule opens onto. */
export const heroRows = compareRows.filter((r) => r.hero);
