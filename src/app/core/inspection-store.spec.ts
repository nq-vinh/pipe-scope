import { TestBed } from '@angular/core/testing';

import { generateAnomalies } from './inspection-data';
import { InspectionStore } from './inspection-store';

describe('InspectionStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [InspectionStore] });
  });

  it('initializes seeded runs and overview computeds', () => {
    const store = TestBed.inject(InspectionStore);
    const expectedDistance = store.runs().reduce((total, run) => total + run.distanceKm, 0);
    const expectedAnomalies = store.runs().reduce((total, run) => total + run.anomalyCount, 0);
    const expectedCritical = store
      .runs()
      .flatMap((run) => generateAnomalies(run.id))
      .filter((anomaly) => anomaly.severity === 'critical').length;

    expect(store.runs()).toHaveLength(24);
    expect(store.runs()[0]?.id).toBe('run-20260720-1');
    expect(Object.keys(store.anomalies())).toEqual(store.runs().map((run) => run.id));
    expect(Object.values(store.anomalies()).every((anomalies) => anomalies.length > 0)).toBe(true);
    expect(store.selectedRun()).toBeNull();
    expect(store.selectedRunAnomalies()).toEqual([]);
    expect(store.selectedAnomaly()).toBeNull();
    expect(store.totalDistanceKm()).toBeCloseTo(expectedDistance);
    expect(store.totalAnomalyCount()).toBe(expectedAnomalies);
    expect(store.criticalAnomalyCount()).toBe(expectedCritical);
  });

  it('selects a run and reuses its eagerly generated anomaly array', () => {
    const store = TestBed.inject(InspectionStore);
    const run = store.runs()[0];

    if (!run) {
      throw new Error('Expected a seeded inspection run.');
    }

    store.selectRun(run.id);

    const cached = store.anomalies()[run.id];

    if (!cached) {
      throw new Error('Expected eagerly generated anomalies.');
    }

    expect(store.selectedRunId()).toBe(run.id);
    expect(store.selectedRun()).toBe(run);
    expect(store.selectedRunAnomalies()).toBe(cached);
    expect(cached).toHaveLength(run.anomalyCount);

    store.selectRun(run.id);

    expect(store.anomalies()[run.id]).toBe(cached);
    expect(store.selectedRunAnomalies()).toBe(cached);
  });

  it('updates selected-run computeds when the active run changes', () => {
    const store = TestBed.inject(InspectionStore);
    const firstRun = store.runs()[0];
    const secondRun = store.runs()[1];

    if (!firstRun || !secondRun) {
      throw new Error('Expected seeded inspection runs.');
    }

    store.selectRun(firstRun.id);
    const firstAnomalies = store.selectedRunAnomalies();

    store.selectRun(secondRun.id);

    expect(store.selectedRun()).toBe(secondRun);
    expect(store.selectedRunAnomalies()).toBe(store.anomalies()[secondRun.id]);
    expect(store.selectedRunAnomalies()).not.toBe(firstAnomalies);
    expect(store.selectedAnomaly()).toBeNull();
  });

  it('selects only anomalies that belong to the active run', () => {
    const store = TestBed.inject(InspectionStore);
    const run = store.runs()[0];

    if (!run) {
      throw new Error('Expected a seeded inspection run.');
    }

    store.selectRun(run.id);
    const anomaly = store.selectedRunAnomalies()[0];

    if (!anomaly) {
      throw new Error('Expected generated anomalies.');
    }

    store.selectAnomaly(anomaly.id);

    expect(store.selectedAnomalyId()).toBe(anomaly.id);
    expect(store.selectedAnomaly()).toBe(anomaly);

    store.selectAnomaly(null);

    expect(store.selectedAnomalyId()).toBeNull();
    expect(store.selectedAnomaly()).toBeNull();

    store.selectAnomaly('unknown-anomaly');

    expect(store.selectedAnomalyId()).toBeNull();
    expect(store.selectedAnomaly()).toBeNull();
  });
});
