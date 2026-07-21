import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';

import {
  formatDate as formatDateValue,
  formatDecimal,
  formatInteger as formatIntegerValue,
} from '../../core/format';
import { InspectionStore } from '../../core/inspection-store';
import { InspectionRun, SEVERITY_RANK, Severity } from '../../core/models';
import { DataTable, DataTableColumn, DataTableSort } from '../../shared/ui/data-table/data-table';
import { Card } from '../../shared/ui/card/card';
import { Button } from '../../shared/ui/button/button';

type SeverityFilter = 'all' | Severity;
type DateRangePreset = 'all' | '12m' | '6m' | '90d';

const SEVERITY_OPTIONS: readonly { readonly value: SeverityFilter; readonly label: string }[] = [
  { value: 'all', label: 'All severities' },
  { value: 'low', label: 'Low or higher' },
  { value: 'medium', label: 'Medium or higher' },
  { value: 'high', label: 'High or higher' },
  { value: 'critical', label: 'Critical only' },
];

const DATE_RANGE_OPTIONS: readonly { readonly value: DateRangePreset; readonly label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: '12m', label: 'Last 12 months' },
  { value: '6m', label: 'Last 6 months' },
  { value: '90d', label: 'Last 90 days' },
];

const DAY_MS = 86_400_000;

@Component({
  selector: 'app-runs-overview',
  imports: [Button, Card, DataTable, ReactiveFormsModule],
  templateUrl: './runs-overview.html',
  styleUrl: './runs-overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'feature-page',
  },
})
export class RunsOverview {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly store = inject(InspectionStore);

  readonly filterForm = this.formBuilder.group({
    search: this.formBuilder.control(''),
    minimumSeverity: this.formBuilder.control<SeverityFilter>('all'),
    dateRange: this.formBuilder.control<DateRangePreset>('all'),
  });

  readonly filterValues = toSignal(this.filterForm.valueChanges, {
    initialValue: this.filterForm.getRawValue(),
  });

  readonly severityOptions = SEVERITY_OPTIONS;
  readonly dateRangeOptions = DATE_RANGE_OPTIONS;
  readonly sort = signal<DataTableSort | null>(null);
  readonly runs = this.store.runs;
  readonly totalDistanceKm = this.store.totalDistanceKm;
  readonly totalAnomalyCount = this.store.totalAnomalyCount;
  readonly criticalAnomalyCount = this.store.criticalAnomalyCount;

  readonly columns: readonly DataTableColumn<InspectionRun>[] = [
    {
      id: 'runId',
      header: 'Run ID',
      cell: (run) => run.id,
    },
    {
      id: 'date',
      header: 'Date',
      cell: (run) => this.formatDate(run.startedAt),
      sortComparator: (first, second) => this.compareDates(first.startedAt, second.startedAt),
    },
    {
      id: 'segment',
      header: 'Segment',
      cell: (run) => run.segment.name,
      sortComparator: (first, second) => first.segment.name.localeCompare(second.segment.name),
    },
    {
      id: 'distance',
      header: 'Distance',
      cell: (run) => `${this.formatNumber(run.distanceKm)} km`,
      sortComparator: (first, second) => first.distanceKm - second.distanceKm,
      align: 'end',
    },
    {
      id: 'anomalies',
      header: 'Anomalies',
      cell: (run) => run.anomalyCount,
      sortComparator: (first, second) => first.anomalyCount - second.anomalyCount,
      align: 'end',
    },
  ];

  private readonly newestRunMs = computed(() =>
    this.store.runs().reduce((newest, run) => Math.max(newest, Date.parse(run.startedAt)), 0),
  );

  private readonly maxSeverityRankByRun = computed(
    () =>
      new Map(
        Object.entries(this.store.maxSeverityByRun()).map(([runId, severity]) => [
          runId,
          severity === undefined ? 0 : SEVERITY_RANK[severity],
        ]),
      ),
  );

  readonly visibleRuns = computed<readonly InspectionRun[]>(() => {
    const filters = this.filterValues();
    const search = filters.search?.trim().toLocaleLowerCase() ?? '';
    const minimumSeverity = filters.minimumSeverity ?? 'all';
    const dateRange = filters.dateRange ?? 'all';
    const cutoff = cutoffFor(dateRange, this.newestRunMs());
    const severityRanks = this.maxSeverityRankByRun();

    return this.store.runs().filter((run) => {
      const matchesSearch = run.segment.name.toLocaleLowerCase().includes(search);
      const matchesDate = dateRange === 'all' || Date.parse(run.startedAt) >= cutoff;
      const matchesSeverity =
        minimumSeverity === 'all' ||
        (severityRanks.get(run.id) ?? 0) >= SEVERITY_RANK[minimumSeverity];

      return matchesSearch && matchesDate && matchesSeverity;
    });
  });

  readonly rowKey = (run: InspectionRun): string => run.id;
  readonly rowLink = (run: InspectionRun): string => `/runs/${run.id}`;
  readonly rowLabel = (run: InspectionRun): string =>
    `Open inspection run ${run.id} for ${run.segment.name}`;

  formatDate(value: string): string {
    return formatDateValue(value);
  }

  formatNumber(value: number): string {
    return formatDecimal(value);
  }

  formatInteger(value: number): string {
    return formatIntegerValue(value);
  }

  clearFilters(): void {
    this.filterForm.reset({ search: '', minimumSeverity: 'all', dateRange: 'all' });
  }

  private compareDates(first: string, second: string): number {
    return Date.parse(first) - Date.parse(second);
  }
}

function cutoffFor(preset: DateRangePreset, anchorMs: number): number {
  const days = preset === '12m' ? 365 : preset === '6m' ? 182 : preset === '90d' ? 90 : 0;
  return anchorMs - days * DAY_MS;
}
