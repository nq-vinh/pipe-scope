const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const DECIMAL_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const TWO_DECIMAL_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const DECIMAL_COMPACT_FORMATTER = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
});

const INTEGER_FORMATTER = new Intl.NumberFormat('en-US');

export function formatDate(value: string): string {
  return DATE_FORMATTER.format(new Date(value));
}

export function formatDecimal(value: number): string {
  return DECIMAL_FORMATTER.format(value);
}

export function formatDecimalCompact(value: number): string {
  return DECIMAL_COMPACT_FORMATTER.format(value);
}

export function formatInteger(value: number): string {
  return INTEGER_FORMATTER.format(value);
}

export function formatFixed(value: number, fractionDigits: number): string {
  if (fractionDigits === 0) {
    return INTEGER_FORMATTER.format(value);
  }

  if (fractionDigits === 1) {
    return DECIMAL_FORMATTER.format(value);
  }

  if (fractionDigits === 2) {
    return TWO_DECIMAL_FORMATTER.format(value);
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatConfidencePct(value: number): number {
  return Math.round(value * 100);
}
