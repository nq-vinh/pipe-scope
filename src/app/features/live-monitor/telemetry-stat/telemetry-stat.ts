import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatFixed } from '../../../core/format';
import { Card } from '../../../shared/ui/card/card';

export type TelemetryTrend = 'rising' | 'falling' | 'steady';

@Component({
  selector: 'app-telemetry-stat',
  imports: [Card],
  templateUrl: './telemetry-stat.html',
  styleUrl: './telemetry-stat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'telemetry-stat-host',
  },
})
export class TelemetryStat {
  readonly label = input.required<string>();
  readonly unit = input.required<string>();
  readonly value = input.required<number | null>();
  readonly previousValue = input<number | null>(null);
  readonly fractionDigits = input(1);
  readonly trendThreshold = input(0.01);

  readonly formattedValue = computed(() => {
    const value = this.value();

    return value === null ? '--' : formatFixed(value, this.fractionDigits());
  });

  readonly trend = computed<TelemetryTrend>(() => {
    const value = this.value();
    const previousValue = this.previousValue();
    const threshold = this.trendThreshold();

    if (value === null || previousValue === null) {
      return 'steady';
    }

    if (value > previousValue + threshold) {
      return 'rising';
    }

    if (value < previousValue - threshold) {
      return 'falling';
    }

    return 'steady';
  });

  readonly trendSymbol = computed(() => {
    const trend = this.trend();

    return trend === 'rising' ? '↑' : trend === 'falling' ? '↓' : '→';
  });

  readonly trendLabel = computed(() => {
    const trend = this.trend();

    return trend.charAt(0).toUpperCase() + trend.slice(1);
  });
}
