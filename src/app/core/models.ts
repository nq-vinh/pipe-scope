export type AnomalyType = 'metal-loss' | 'crack' | 'dent' | 'weld-anomaly' | 'corrosion';

export const ANOMALY_TYPE_LABELS: Readonly<Record<AnomalyType, string>> = {
  'metal-loss': 'Metal loss',
  crack: 'Crack',
  dent: 'Dent',
  'weld-anomaly': 'Weld anomaly',
  corrosion: 'Corrosion',
};

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export const SEVERITY_RANK: Readonly<Record<Severity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export type RunStatus = 'completed' | 'processing';

export interface PipelineSegment {
  readonly id: string;
  readonly name: string;
  readonly lengthKm: number;
  readonly diameterInch: number;
}

export interface InspectionRun {
  readonly id: string;
  readonly segment: PipelineSegment;
  readonly startedAt: string;
  readonly distanceKm: number;
  readonly durationMin: number;
  readonly status: RunStatus;
  readonly anomalyCount: number;
  readonly avgVelocityMps: number;
  readonly maxPressureBar: number;
}

export interface Anomaly {
  readonly id: string;
  readonly runId: string;
  readonly distanceM: number;
  readonly type: AnomalyType;
  readonly severity: Severity;
  readonly confidence: number;
  readonly depthPct: number;
  readonly lengthMm: number;
  readonly widthMm: number;
  readonly clockPosition: number;
}

export interface TelemetryFrame {
  readonly timestampMs: number;
  readonly velocityMps: number;
  readonly pressureBar: number;
  readonly temperatureC: number;
  readonly ultrasound: Float32Array;
}
