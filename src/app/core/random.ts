export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function pick<T>(rng: Rng, values: readonly T[]): T {
  if (values.length === 0) {
    throw new RangeError('Cannot pick from an empty collection.');
  }

  const value = values[Math.floor(rng() * values.length)];

  if (value === undefined) {
    throw new RangeError('Random selection fell outside the collection.');
  }

  return value;
}

export function range(rng: Rng, minimum: number, maximum: number): number {
  return minimum + rng() * (maximum - minimum);
}

export function int(rng: Rng, minimum: number, maximum: number): number {
  return Math.floor(range(rng, minimum, maximum + 1));
}

export function gaussian(rng: Rng, mean = 0, standardDeviation = 1): number {
  const first = Math.max(rng(), Number.EPSILON);
  const second = rng();
  const standardNormal = Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  return mean + standardNormal * standardDeviation;
}

export function round(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
