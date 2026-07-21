import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

import { generateAnomalies, generateRuns, PIPESCOPE_SEED } from './inspection-data';
import { Anomaly, InspectionRun, SEVERITY_RANK, Severity } from './models';

interface InspectionState {
  readonly runs: InspectionRun[];
  readonly anomalies: Record<string, Anomaly[]>;
  readonly selectedRunId: string | null;
  readonly selectedAnomalyId: string | null;
}

const initialState: InspectionState = {
  runs: [],
  anomalies: {},
  selectedRunId: null,
  selectedAnomalyId: null,
};

export const InspectionStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ anomalies, runs, selectedAnomalyId, selectedRunId }) => ({
    selectedRun: computed(() => runs().find((run) => run.id === selectedRunId()) ?? null),
    selectedRunAnomalies: computed(() => {
      const runId = selectedRunId();
      return runId ? (anomalies()[runId] ?? []) : [];
    }),
    selectedAnomaly: computed(() => {
      const runId = selectedRunId();
      const anomalyId = selectedAnomalyId();
      return runId && anomalyId
        ? (anomalies()[runId]?.find((anomaly) => anomaly.id === anomalyId) ?? null)
        : null;
    }),
    totalDistanceKm: computed(() => runs().reduce((total, run) => total + run.distanceKm, 0)),
    totalAnomalyCount: computed(() => runs().reduce((total, run) => total + run.anomalyCount, 0)),
    criticalAnomalyCount: computed(() =>
      Object.values(anomalies()).reduce(
        (total, runAnomalies) =>
          total + runAnomalies.filter((anomaly) => anomaly.severity === 'critical').length,
        0,
      ),
    ),
    maxSeverityByRun: computed<Record<string, Severity | undefined>>(() =>
      Object.fromEntries(
        runs().map((run) => {
          const severity = anomalies()[run.id]?.reduce<Severity | undefined>(
            (maximum, anomaly) =>
              maximum === undefined || SEVERITY_RANK[anomaly.severity] > SEVERITY_RANK[maximum]
                ? anomaly.severity
                : maximum,
            undefined,
          );

          return [run.id, severity];
        }),
      ),
    ),
  })),
  withMethods((store) => ({
    selectRun(runId: string): void {
      const run = store.runs().find((candidate) => candidate.id === runId);

      if (!run) {
        patchState(store, { selectedRunId: null, selectedAnomalyId: null });
        return;
      }

      const runChanged = store.selectedRunId() !== runId;

      patchState(store, {
        selectedRunId: runId,
        selectedAnomalyId: runChanged ? null : store.selectedAnomalyId(),
      });
    },
    selectAnomaly(anomalyId: string | null): void {
      const runId = store.selectedRunId();
      const isKnown =
        anomalyId === null ||
        (runId !== null && store.anomalies()[runId]?.some((anomaly) => anomaly.id === anomalyId));
      patchState(store, { selectedAnomalyId: isKnown ? anomalyId : null });
    },
  })),
  withHooks({
    onInit(store): void {
      const runs = generateRuns(PIPESCOPE_SEED, 24);
      const anomalies = Object.fromEntries(runs.map((run) => [run.id, generateAnomalies(run.id)]));

      patchState(store, { runs, anomalies });
    },
  }),
);
