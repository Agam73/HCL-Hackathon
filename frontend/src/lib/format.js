const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** 74999 -> "₹74,999" (Indian digit grouping). */
export const formatPrice = (amount) => inr.format(amount ?? 0);

export const formatCount = (n) => new Intl.NumberFormat('en-IN').format(n ?? 0);

/** "screenSize" / "5g" -> "Screen size" / "5G" for the specification table. */
export function formatSpecName(key) {
  if (/^\d/.test(key)) return key.toUpperCase();
  const spaced = key.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function formatSpecValue(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return String(value);
}

export const AVAILABILITY_LABELS = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Low stock',
  OUT_OF_STOCK: 'Out of stock',
};

export const ROLE_LABELS = {
  CUSTOMER: 'Customer',
  STORE_MANAGER: 'Store Manager',
  ADMIN: 'Administrator',
};

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
