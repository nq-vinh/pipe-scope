import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { interpolateLab } from 'd3-interpolate';

import { setupHiDpiCanvas } from '../../../core/canvas';
import { generateHeatmap, HEATMAP_COLUMNS, HEATMAP_ROWS } from '../../../core/inspection-data';
import { formatInteger } from '../../../core/format';
import { clamp } from '../../../core/random';
import { ANOMALY_TYPE_LABELS, Anomaly } from '../../../core/models';
import { readThemeToken, ThemeService } from '../../../core/theme';

const CSS_WIDTH = 256;
const CSS_HEIGHT = 192;

interface PeakCell {
  readonly row: number;
  readonly column: number;
  readonly amplitude: number;
}

@Component({
  selector: 'app-heatmap',
  templateUrl: './heatmap.html',
  styleUrl: './heatmap.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'heatmap-host',
  },
})
export class Heatmap {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly anomaly = input.required<Anomaly>();
  readonly values = computed(() =>
    generateHeatmap(this.anomaly().id, HEATMAP_ROWS, HEATMAP_COLUMNS),
  );
  readonly peakCell = computed<PeakCell>(() => findPeak(this.values()));
  readonly ariaLabel = computed(() => {
    const anomaly = this.anomaly();
    const peak = this.peakCell();

    return `Ultrasound heatmap for ${ANOMALY_TYPE_LABELS[anomaly.type].toLowerCase()} at ${formatInteger(Math.round(anomaly.distanceM))} m. Peak amplitude ${peak.amplitude.toFixed(2)} at row ${peak.row}, column ${peak.column}.`;
  });

  private readonly renderHeatmap = effect(() => {
    const canvas = this.canvas();
    const values = this.values();
    const resolvedTheme = this.theme.resolved();

    if (!canvas) {
      return;
    }

    this.drawHeatmap(canvas.nativeElement, values, resolvedTheme);
  });

  private drawHeatmap(
    canvas: HTMLCanvasElement,
    values: Float32Array,
    resolvedTheme: 'light' | 'dark',
  ): void {
    const context = canvas.getContext('2d');
    const view = this.document.defaultView;
    const styles = view?.getComputedStyle(this.document.documentElement);

    if (!context || !view || !styles) {
      return;
    }

    const lowColor = readThemeToken(
      styles,
      resolvedTheme === 'dark' ? '--color-surface' : '--color-bg',
    );
    const middleColor = readThemeToken(styles, '--color-chart-1');
    const highColor = readThemeToken(styles, '--color-severity-critical');

    if (!lowColor || !middleColor || !highColor) {
      return;
    }

    setupHiDpiCanvas(canvas, context, CSS_WIDTH, CSS_HEIGHT, view.devicePixelRatio);
    context.clearRect(0, 0, CSS_WIDTH, CSS_HEIGHT);

    const lowToMiddle = interpolateLab(lowColor, middleColor);
    const middleToHigh = interpolateLab(middleColor, highColor);
    const colorRamp = (value: number): string =>
      value < 0.5 ? lowToMiddle(value * 2) : middleToHigh((value - 0.5) * 2);
    const cellWidth = CSS_WIDTH / HEATMAP_COLUMNS;
    const cellHeight = CSS_HEIGHT / HEATMAP_ROWS;

    for (let row = 0; row < HEATMAP_ROWS; row += 1) {
      for (let column = 0; column < HEATMAP_COLUMNS; column += 1) {
        const value = values[row * HEATMAP_COLUMNS + column] ?? 0;
        context.fillStyle = colorRamp(clamp(value, 0, 1));
        context.fillRect(column * cellWidth, row * cellHeight, cellWidth + 0.5, cellHeight + 0.5);
      }
    }
  }
}

function findPeak(values: Float32Array): PeakCell {
  let peakIndex = 0;

  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) > (values[peakIndex] ?? 0)) {
      peakIndex = index;
    }
  }

  return {
    row: Math.floor(peakIndex / HEATMAP_COLUMNS) + 1,
    column: (peakIndex % HEATMAP_COLUMNS) + 1,
    amplitude: values[peakIndex] ?? 0,
  };
}
