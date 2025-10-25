// Helper utilities for monetary calculations using integer cents to avoid floating point issues
export const toCents = (amount) => {
  const n = Number(amount) || 0;
  return Math.round(n * 100);
};

export const centsToAmount = (cents) => {
  return Number((Math.round(cents) / 100).toFixed(2));
};

export const sumCents = (centsArray) => {
  return centsArray.reduce((s, c) => s + (c || 0), 0);
};
