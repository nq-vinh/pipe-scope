import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  linkedSignal,
  output,
  viewChildren,
} from '@angular/core';
import { scaleLinear } from 'd3-scale';

import { formatConfidencePct, formatDecimalCompact, formatInteger } from '../../../core/format';
import { clamp } from '../../../core/random';
import { ANOMALY_TYPE_LABELS, Anomaly, AnomalyType, SEVERITY_RANK } from '../../../core/models';
import { DataTable, DataTableColumn } from '../../../shared/ui/data-table/data-table';

interface PositionedMarker {
  readonly anomaly: Anomaly;
  readonly index: number;
  readonly x: number;
  readonly labelX: number;
  readonly ariaLabel: string;
}

const SVG_WIDTH = 900;
const SVG_HEIGHT = 240;
const AXIS_START = 56;
const AXIS_END = 844;
const TUBE_Y = 101;
const TUBE_HEIGHT = 58;
const MARKER_Y = TUBE_Y + TUBE_HEIGHT / 2;
const AXIS_Y = 196;
const LABEL_HALF_WIDTH = 92;

@Component({
  selector: 'app-pipeline-map',
  imports: [DataTable],
  templateUrl: './pipeline-map.html',
  styleUrl: './pipeline-map.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'pipeline-map-host',
  },
})
export class PipelineMap {
  readonly svgWidth = SVG_WIDTH;
  readonly svgHeight = SVG_HEIGHT;
  readonly axisStart = AXIS_START;
  readonly axisEnd = AXIS_END;
  readonly tubeY = TUBE_Y;
  readonly tubeHeight = TUBE_HEIGHT;
  readonly markerY = MARKER_Y;
  readonly axisY = AXIS_Y;

  readonly anomalies = input.required<readonly Anomaly[]>();
  readonly distanceKm = input.required<number>();
  readonly runId = input.required<string>();
  readonly segmentName = input.required<string>();
  readonly selectedAnomalyId = input<string | null>(null);
  readonly anomalySelected = output<string | null>();

  readonly sortedAnomalies = computed<readonly Anomaly[]>(() =>
    [...this.anomalies()].sort((first, second) => first.distanceM - second.distanceM),
  );

  readonly distanceScale = computed(() =>
    scaleLinear<number>()
      .domain([0, Math.max(1, this.distanceKm())])
      .range([AXIS_START, AXIS_END]),
  );

  readonly axisTicks = computed<readonly number[]>(() => this.distanceScale().ticks(7));

  readonly weldTicks = computed<readonly number[]>(() => {
    const maximum = Math.max(1, this.distanceKm());
    return this.axisTicks().filter((tick) => tick > 0 && tick < maximum);
  });

  readonly positionedMarkers = computed<readonly PositionedMarker[]>(() => {
    const scale = this.distanceScale();

    return this.sortedAnomalies().map((anomaly, index) => {
      const x = scale(anomaly.distanceM / 1_000);

      return {
        anomaly,
        index,
        x,
        labelX: clamp(x, AXIS_START + LABEL_HALF_WIDTH, AXIS_END - LABEL_HALF_WIDTH),
        ariaLabel: this.markerLabel(anomaly),
      };
    });
  });

  readonly activeMarkerIndex = linkedSignal<readonly PositionedMarker[], number>({
    source: this.positionedMarkers,
    computation: (markers, previous) =>
      markers.length === 0 ? 0 : Math.min(previous?.value ?? 0, markers.length - 1),
  });

  readonly activeMarker = computed<PositionedMarker | null>(
    () => this.positionedMarkers()[this.activeMarkerIndex()] ?? null,
  );

  readonly summary = computed(() => {
    const anomalies = this.sortedAnomalies();
    const count = anomalies.length;

    if (count === 0) {
      return `${this.segmentName()} pipeline map. No anomalies were detected in this run.`;
    }

    const selected = this.selectedAnomalyId();
    const selectedAnomaly = anomalies.find((anomaly) => anomaly.id === selected);
    const selectionText = selectedAnomaly
      ? ` ${this.markerLabel(selectedAnomaly)} is selected.`
      : '';

    return `${this.segmentName()} pipeline map covering ${this.formatTick(this.distanceKm())} km. ${count} anomalies are positioned along the run.${selectionText}`;
  });

  readonly tableColumns: readonly DataTableColumn<Anomaly>[] = [
    {
      id: 'id',
      header: 'Anomaly',
      cell: (anomaly) => anomaly.id,
    },
    {
      id: 'distance',
      header: 'Distance',
      cell: (anomaly) => `${this.formatDistance(anomaly.distanceM)} m`,
      sortComparator: (first, second) => first.distanceM - second.distanceM,
      align: 'end',
    },
    {
      id: 'type',
      header: 'Type',
      cell: (anomaly) => ANOMALY_TYPE_LABELS[anomaly.type],
      sortComparator: (first, second) =>
        ANOMALY_TYPE_LABELS[first.type].localeCompare(ANOMALY_TYPE_LABELS[second.type]),
    },
    {
      id: 'severity',
      header: 'Severity',
      cell: (anomaly) => anomaly.severity,
      sortComparator: (first, second) =>
        SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity],
    },
    {
      id: 'confidence',
      header: 'Confidence',
      cell: (anomaly) => `${formatConfidencePct(anomaly.confidence)} %`,
      sortComparator: (first, second) => first.confidence - second.confidence,
      align: 'end',
    },
  ];

  readonly tableRowKey = (anomaly: Anomaly): string => anomaly.id;
  readonly tableRowLink = (anomaly: Anomaly): string =>
    `/runs/${this.runId()}?anomaly=${encodeURIComponent(anomaly.id)}`;
  readonly tableRowLabel = (anomaly: Anomaly): string => `Select ${this.markerLabel(anomaly)}`;

  private readonly markerElements = viewChildren<ElementRef<SVGGElement>>('marker');

  private readonly focusSelectedMarker = effect(() => {
    const selectedAnomalyId = this.selectedAnomalyId();
    const markers = this.positionedMarkers();
    const elements = this.markerElements();

    if (!selectedAnomalyId) {
      return;
    }

    const index = markers.findIndex((marker) => marker.anomaly.id === selectedAnomalyId);

    if (index < 0 || !elements[index]) {
      return;
    }

    this.activeMarkerIndex.set(index);
    queueMicrotask(() => this.markerElements()[index]?.nativeElement.focus());
  });

  protected handleMarkerKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.focusMarker(Math.max(0, index - 1));
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusMarker(Math.min(this.positionedMarkers().length - 1, index + 1));
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.focusMarker(0);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.focusMarker(this.positionedMarkers().length - 1);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      this.selectMarker(index);
    }
  }

  protected selectMarker(index: number): void {
    const marker = this.positionedMarkers()[index];

    if (!marker) {
      return;
    }

    this.activeMarkerIndex.set(index);
    this.anomalySelected.emit(marker.anomaly.id);
  }

  protected formatTick(value: number): string {
    return formatDecimalCompact(value);
  }

  protected formatDistance(value: number): string {
    return formatInteger(Math.round(value));
  }

  protected typeLabel(type: AnomalyType): string {
    return ANOMALY_TYPE_LABELS[type];
  }

  private focusMarker(index: number): void {
    const markers = this.positionedMarkers();

    if (markers.length === 0) {
      return;
    }

    const safeIndex = clamp(index, 0, markers.length - 1);
    this.activeMarkerIndex.set(safeIndex);
    this.markerElements()[safeIndex]?.nativeElement.focus();
  }

  private markerLabel(anomaly: Anomaly): string {
    return `${ANOMALY_TYPE_LABELS[anomaly.type]}, ${anomaly.severity} severity, at ${this.formatDistance(anomaly.distanceM)} m, ${formatConfidencePct(anomaly.confidence)} % confidence`;
  }
}
