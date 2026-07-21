import { DOCUMENT } from '@angular/common';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, scan, share, switchMap } from 'rxjs';

import { TelemetryService } from '../../core/telemetry';
import { TelemetryFrame } from '../../core/models';
import { TelemetryStat } from './telemetry-stat/telemetry-stat';
import { WaveformCanvas } from './waveform-canvas/waveform-canvas';

interface TelemetryReading {
  readonly current: TelemetryFrame;
  readonly previous: TelemetryFrame | null;
}

@Component({
  selector: 'app-live-monitor',
  imports: [TelemetryStat, WaveformCanvas],
  templateUrl: './live-monitor.html',
  styleUrl: './live-monitor.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'feature-page',
  },
})
export class LiveMonitor {
  private readonly document = inject(DOCUMENT);
  private readonly telemetry = inject(TelemetryService);
  private readonly window = this.document.defaultView;

  readonly reducedMotion =
    this.window?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  readonly paused = signal(this.reducedMotion);

  readonly frames$: Observable<TelemetryFrame> = toObservable(this.paused).pipe(
    switchMap((paused) => (paused ? EMPTY : this.telemetry.frames$)),
    share(),
  );

  private readonly reading = toSignal(
    this.frames$.pipe(
      scan<TelemetryFrame, TelemetryReading | null>(
        (previous, current) => ({
          current,
          previous: previous?.current ?? null,
        }),
        null,
      ),
    ),
    { initialValue: null },
  );

  readonly currentFrame = computed(() => this.reading()?.current ?? null);
  readonly previousFrame = computed(() => this.reading()?.previous ?? null);
}
