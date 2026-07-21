import {
  generateAnomalies,
  generateHeatmap,
  generateRuns,
  PIPESCOPE_SEED,
} from './inspection-data';

describe('inspection data', () => {
  it('generates deterministic runs for a seed and different runs for another seed', () => {
    const first = generateRuns(PIPESCOPE_SEED, 24);
    const second = generateRuns(PIPESCOPE_SEED, 24);

    expect(second).toEqual(first);
    expect(generateRuns(PIPESCOPE_SEED + 1, 24)).not.toEqual(first);
    expect(first[0]).toEqual({
      id: 'run-20260720-1',
      segment: {
        id: 'saxon-industrial-loop',
        name: 'Saxon Industrial Loop',
        lengthKm: 27.6,
        diameterInch: 24,
      },
      startedAt: '2026-07-13T17:56:19.550Z',
      distanceKm: 23.7,
      durationMin: 171,
      status: 'processing',
      anomalyCount: 11,
      avgVelocityMps: 2.36,
      maxPressureBar: 65.2,
    });
  });

  it('uses stable run and anomaly ids', () => {
    const runs = generateRuns(PIPESCOPE_SEED, 3);

    expect(runs.map((run) => run.id)).toEqual([
      'run-20260720-1',
      'run-20260720-2',
      'run-20260720-3',
    ]);

    const run = runs[0];

    if (!run) {
      throw new Error('Expected a generated inspection run.');
    }

    const anomalies = generateAnomalies(run.id);

    expect(generateAnomalies(run.id)).toEqual(anomalies);
    expect(generateAnomalies('run-20260720-2')).not.toEqual(anomalies);
    expect(anomalies.map((anomaly) => anomaly.id)).toEqual(
      anomalies.map((_, index) => `${run.id}-anomaly-${index + 1}`),
    );
    expect(anomalies[0]).toEqual({
      id: 'run-20260720-1-anomaly-1',
      runId: 'run-20260720-1',
      distanceM: 1627.6,
      type: 'dent',
      severity: 'high',
      confidence: 0.772,
      depthPct: 33.4,
      lengthMm: 54.1,
      widthMm: 4.5,
      clockPosition: 4,
    });
  });

  it('keeps run values within the physical constraints', () => {
    const runs = generateRuns(PIPESCOPE_SEED, 24);

    for (const run of runs) {
      expect(run.distanceKm).toBeGreaterThan(0);
      expect(run.distanceKm).toBeLessThanOrEqual(run.segment.lengthKm);
      expect(run.avgVelocityMps).toBeGreaterThanOrEqual(0.8);
      expect(run.avgVelocityMps).toBeLessThanOrEqual(2.5);
      expect(run.maxPressureBar).toBeGreaterThanOrEqual(40);
      expect(run.maxPressureBar).toBeLessThanOrEqual(95);
      expect(run.durationMin).toBeGreaterThan(0);
    }

    const timestamps = runs.map((run) => Date.parse(run.startedAt));
    expect(timestamps).toEqual([...timestamps].sort((first, second) => second - first));
  });

  it('matches anomaly counts and keeps anomaly values within each run', () => {
    const runs = generateRuns(PIPESCOPE_SEED, 24);

    for (const run of runs) {
      const anomalies = generateAnomalies(run.id);

      expect(anomalies).toHaveLength(run.anomalyCount);

      for (const anomaly of anomalies) {
        expect(anomaly.runId).toBe(run.id);
        expect(anomaly.distanceM).toBeGreaterThan(0);
        expect(anomaly.distanceM).toBeLessThanOrEqual(run.distanceKm * 1_000);
        expect(anomaly.confidence).toBeGreaterThanOrEqual(0.62);
        expect(anomaly.confidence).toBeLessThanOrEqual(0.99);

        if (anomaly.depthPct >= 50) {
          expect(anomaly.severity).toBe('critical');
        } else if (anomaly.depthPct >= 30) {
          expect(anomaly.severity).toBe('high');
        } else if (anomaly.depthPct >= 15) {
          expect(anomaly.severity).toBe('medium');
        } else {
          expect(anomaly.severity).toBe('low');
        }
      }
    }
  });

  it('generates deterministic heatmaps with the requested shape and bounded values', () => {
    const first = generateHeatmap('run-20260720-1-anomaly-1');
    const second = generateHeatmap('run-20260720-1-anomaly-1');
    const different = generateHeatmap('run-20260720-1-anomaly-2');
    const customShape = generateHeatmap('run-20260720-1-anomaly-1', 7, 11);

    expect(second).toEqual(first);
    expect(different).not.toEqual(first);
    expect(first).toHaveLength(24 * 32);
    expect(customShape).toHaveLength(7 * 11);
    expect(Math.min(...first)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...first)).toBeLessThanOrEqual(1);
    expect(Math.min(...customShape)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...customShape)).toBeLessThanOrEqual(1);
  });
});
