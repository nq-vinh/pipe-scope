import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { formatDate as formatDateValue, formatDecimal } from '../../core/format';
import { InspectionStore } from '../../core/inspection-store';
import { Badge } from '../../shared/ui/badge/badge';
import { Card } from '../../shared/ui/card/card';
import { AnomalyPanel } from './anomaly-panel/anomaly-panel';
import { PipelineMap } from './pipeline-map/pipeline-map';

@Component({
  selector: 'app-run-detail',
  imports: [AnomalyPanel, Badge, Card, PipelineMap, RouterLink],
  templateUrl: './run-detail.html',
  styleUrl: './run-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'feature-page',
  },
})
export class RunDetail {
  private readonly store = inject(InspectionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly runId = input.required<string>();
  readonly anomaly = input<string | undefined>();
  readonly run = this.store.selectedRun;
  readonly anomalies = this.store.selectedRunAnomalies;
  readonly selectedAnomaly = this.store.selectedAnomaly;
  readonly selectedAnomalyId = this.store.selectedAnomalyId;
  readonly statusLabel = computed(() =>
    this.run()?.status === 'processing' ? 'Processing' : 'Completed',
  );
  readonly statusSeverity = computed(() =>
    this.run()?.status === 'processing' ? 'medium' : 'low',
  );

  private readonly synchronizeRouteSelection = effect(() => {
    const runId = this.runId();
    const anomalyId = this.anomaly();

    this.store.selectRun(runId);
    this.store.selectAnomaly(anomalyId ?? null);
  });

  formatDate(value: string): string {
    return formatDateValue(value);
  }

  formatNumber(value: number): string {
    return formatDecimal(value);
  }

  formatDuration(value: number): string {
    return `${Math.round(value)} min`;
  }

  protected selectAnomaly(anomalyId: string | null): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { anomaly: anomalyId },
      replaceUrl: true,
    });
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.selectedAnomaly()) {
      event.preventDefault();
      this.selectAnomaly(null);
    }
  }

  protected anomalyClosed(): void {
    this.selectAnomaly(null);
  }
}
