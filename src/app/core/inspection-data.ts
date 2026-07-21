import { Anomaly, AnomalyType, InspectionRun, PipelineSegment, Severity } from './models';
import { clamp, createRng, gaussian, int, pick, range, round } from './random';

export const PIPESCOPE_SEED = 20260720;
export const HEATMAP_ROWS = 24;
export const HEATMAP_COLUMNS = 32;

const DAY_MS = 86_400_000;
const REFERENCE_DATE_MS = Date.UTC(2026, 6, 20, 9, 0, 0);

const SEGMENTS: readonly PipelineSegment[] = [
  { id: 'elbe-crossing-north', name: 'Elbe Crossing North', lengthKm: 38.4, diameterInch: 36 },
  { id: 'bergen-feeder-line', name: 'Bergen Feeder Line', lengthKm: 62.7, diameterInch: 30 },
  { id: 'rhine-valley-main', name: 'Rhine Valley Main', lengthKm: 91.2, diameterInch: 42 },
  {
    id: 'skagerrak-coastal-link',
    name: 'Skagerrak Coastal Link',
    lengthKm: 54.9,
    diameterInch: 28,
  },
  { id: 'saxon-industrial-loop', name: 'Saxon Industrial Loop', lengthKm: 27.6, diameterInch: 24 },
  { id: 'weser-plains-transit', name: 'Weser Plains Transit', lengthKm: 73.5, diameterInch: 40 },
];

const ANOMALY_TYPES: readonly AnomalyType[] = [
  'metal-loss',
  'crack',
  'dent',
  'weld-anomaly',
  'corrosion',
];

export function generateRuns(seed: number, count: number): InspectionRun[] {
  const rng = createRng(seed);
  const runs: InspectionRun[] = [];
  let elapsedDays = range(rng, 1, 7);

  for (let index = 0; index < Math.max(0, Math.floor(count)); index += 1) {
    if (index > 0) {
      elapsedDays += range(rng, 18, 28);
    }

    const segment = pick(rng, SEGMENTS);
    const status = index < 2 && rng() < 0.65 ? 'processing' : 'completed';
    const distanceKm =
      status === 'completed' ? segment.lengthKm : segment.lengthKm * range(rng, 0.48, 0.92);
    const avgVelocityMps = range(rng, 0.8, 2.5);
    const durationMin = (distanceKm * 1_000) / avgVelocityMps / 60;
    const anomalyCount = Math.max(
      1,
      Math.round(int(rng, 5, 24) * (status === 'processing' ? distanceKm / segment.lengthKm : 1)),
    );

    runs.push({
      id: `run-${seed}-${index + 1}`,
      segment,
      startedAt: new Date(REFERENCE_DATE_MS - elapsedDays * DAY_MS).toISOString(),
      distanceKm: round(distanceKm, 2),
      durationMin: Math.round(durationMin * range(rng, 0.98, 1.08)),
      status,
      anomalyCount,
      avgVelocityMps: round(avgVelocityMps, 2),
      maxPressureBar: round(range(rng, 40, 95), 1),
    });
  }

  return runs;
}

export function generateAnomalies(runId: string): Anomaly[] {
  const run = resolveRun(runId);
  const rng = createRng(hashString(runId));
  const anomalies: Anomaly[] = [];
  const distanceM = run?.distanceKm ? run.distanceKm * 1_000 : range(rng, 18_000, 85_000);
  const count = run?.anomalyCount ?? int(rng, 5, 24);

  for (let index = 0; index < count; index += 1) {
    const depthPct = round(clamp(gaussian(rng, 28, 17), 3, 74), 1);

    anomalies.push({
      id: `${runId}-anomaly-${index + 1}`,
      runId,
      distanceM: round(((index + range(rng, 0.15, 0.85)) / count) * distanceM, 1),
      type: pick(rng, ANOMALY_TYPES),
      severity: severityForDepth(depthPct),
      confidence: round(range(rng, 0.62, 0.99), 3),
      depthPct,
      lengthMm: round(clamp(gaussian(rng, 38, 20), 4, 120), 1),
      widthMm: round(clamp(gaussian(rng, 17, 9), 2, 65), 1),
      clockPosition: int(rng, 1, 12),
    });
  }

  return anomalies;
}

export function generateHeatmap(
  anomalyId: string,
  rows = HEATMAP_ROWS,
  cols = HEATMAP_COLUMNS,
): Float32Array {
  const safeRows = Math.max(1, Math.floor(rows));
  const safeCols = Math.max(1, Math.floor(cols));
  const rng = createRng(hashString(anomalyId));
  const values = new Float32Array(safeRows * safeCols);
  const centerRow = range(rng, safeRows * 0.25, safeRows * 0.75);
  const centerCol = range(rng, safeCols * 0.25, safeCols * 0.75);
  const rowSpread = range(rng, safeRows * 0.1, safeRows * 0.24);
  const colSpread = range(rng, safeCols * 0.1, safeCols * 0.24);
  const phase = range(rng, 0, Math.PI * 2);

  for (let row = 0; row < safeRows; row += 1) {
    for (let col = 0; col < safeCols; col += 1) {
      const rowDistance = (row - centerRow) / rowSpread;
      const colDistance = (col - centerCol) / colSpread;
      const hotSpot = Math.exp(-0.5 * (rowDistance ** 2 + colDistance ** 2));
      const structure = (0.1 * (Math.sin(row * 0.72 + col * 0.31 + phase) + 1)) / 2;
      const noise = range(rng, 0, 0.12);
      values[row * safeCols + col] = clamp(0.04 + hotSpot * 0.82 + structure + noise, 0, 1);
    }
  }

  return values;
}

function resolveRun(runId: string): InspectionRun | undefined {
  const match = /^run-(-?\d+)-(\d+)$/.exec(runId);

  if (!match) {
    return undefined;
  }

  const seed = Number(match[1]);
  const ordinal = Number(match[2]);

  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(ordinal) || ordinal < 1) {
    return undefined;
  }

  const cachedRuns = RUNS_BY_SEED.get(seed);

  if (cachedRuns && cachedRuns.length >= ordinal) {
    return cachedRuns[ordinal - 1];
  }

  const runs = generateRuns(seed, ordinal);
  RUNS_BY_SEED.set(seed, runs);
  return runs[ordinal - 1];
}

function severityForDepth(depthPct: number): Severity {
  if (depthPct >= 50) {
    return 'critical';
  }

  if (depthPct >= 30) {
    return 'high';
  }

  if (depthPct >= 15) {
    return 'medium';
  }

  return 'low';
}

function hashString(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

const RUNS_BY_SEED = new Map<number, InspectionRun[]>();
