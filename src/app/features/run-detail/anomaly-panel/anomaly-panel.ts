import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { ANOMALY_TYPE_LABELS, Anomaly } from '../../../core/models';
import { formatConfidencePct, formatDecimalCompact } from '../../../core/format';
import { Badge } from '../../../shared/ui/badge/badge';
import { Button } from '../../../shared/ui/button/button';
import { Heatmap } from '../heatmap/heatmap';

@Component({
  selector: 'app-anomaly-panel',
  imports: [Badge, Button, Heatmap],
  templateUrl: './anomaly-panel.html',
  styleUrl: './anomaly-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'anomaly-panel-host',
  },
})
export class AnomalyPanel {
  readonly anomaly = input.required<Anomaly>();
  readonly closed = output<void>();

  readonly typeLabel = computed(() => ANOMALY_TYPE_LABELS[this.anomaly().type]);
  readonly confidencePercent = computed(() => formatConfidencePct(this.anomaly().confidence));

  protected formatNumber(value: number): string {
    return formatDecimalCompact(value);
  }
}
