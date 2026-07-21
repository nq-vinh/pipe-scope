import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { Observable } from 'rxjs';

import { setupHiDpiCanvas } from '../../../core/canvas';
import { TelemetryFrame } from '../../../core/models';
import { readThemeToken, ThemeService } from '../../../core/theme';
import { Icon } from '../../../shared/ui/icon/icon';

const FRAME_RATE = 40;
const HISTORY_SECONDS = 4;
const FRAME_BUFFER_SIZE = FRAME_RATE * HISTORY_SECONDS;
const TRACE_PERSISTENCE = 10;
const DOWN_SAMPLE_EVERY = 4;
const MAX_LATEST_READINGS = 10;
const HEALTH_UPDATE_MS = 1_000;
const SUMMARY_UPDATE_MS = 2_000;
const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 280;

interface WaveformColors {
  background: string;
  center: string;
  grid: string;
  waveform: string;
}

@Component({
  selector: 'app-waveform-canvas',
  imports: [Icon],
  templateUrl: './waveform-canvas.html',
  styleUrl: './waveform-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'waveform-canvas-host',
  },
})
export class WaveformCanvas {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);
  private readonly window = this.document.defaultView;
  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');

  readonly frames = input.required<Observable<TelemetryFrame>>();
  readonly paused = model.required<boolean>();
  readonly latestReadings = signal<readonly TelemetryFrame[]>([]);
  readonly framesReceived = signal(0);
  readonly drawFps = signal(0);
  readonly liveSummary = signal('No live telemetry is currently available.');
  readonly canvasLabel = computed(() =>
    this.paused()
      ? 'Ultrasound trace paused. The last rendered trace remains visible.'
      : 'Live ultrasound amplitude trace with a short persistence trail of recent frames.',
  );

  private readonly frameBuffer: (TelemetryFrame | null)[] = Array(FRAME_BUFFER_SIZE).fill(null);
  private readonly colors: WaveformColors = {
    background: '',
    center: '',
    grid: '',
    waveform: '',
  };
  private context: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;
  private canvasWidth = DEFAULT_CANVAS_WIDTH;
  private canvasHeight = DEFAULT_CANVAS_HEIGHT;
  private devicePixelRatio = 1;
  private writeIndex = 0;
  private bufferedFrameCount = 0;
  private receivedCount = 0;
  private downSampleCount = 0;
  private lastSummaryUpdate = 0;
  private fpsWindowStart: number | null = null;
  private drawCountInWindow = 0;
  private canvasDirty = true;

  private readonly subscribeToFrames = effect((onCleanup) => {
    const subscription = this.frames().subscribe((frame) => this.acceptFrame(frame));
    onCleanup(() => subscription.unsubscribe());
  });

  private readonly setupCanvas = effect((onCleanup) => {
    const canvas = this.canvas();

    if (!canvas) {
      return;
    }

    const canvasElement = canvas.nativeElement;
    const resizeObserverConstructor = this.window?.ResizeObserver;
    const resizeObserver = resizeObserverConstructor
      ? new resizeObserverConstructor((entries) => {
          const entry = entries[0];
          this.resizeCanvas(entry?.contentRect.width, entry?.contentRect.height);
        })
      : null;
    const handleVisibilityChange = (): void => this.handleVisibilityChange();

    resizeObserver?.observe(canvasElement);
    this.document.addEventListener('visibilitychange', handleVisibilityChange);
    this.resizeCanvas();

    onCleanup(() => {
      resizeObserver?.disconnect();
      this.document.removeEventListener('visibilitychange', handleVisibilityChange);
      this.stopDrawing();
    });
  });

  private readonly synchronizeColors = effect(() => {
    const canvas = this.canvas();
    const resolvedTheme = this.theme.resolved();

    if (!canvas) {
      return;
    }

    this.canvasDirty = true;
    this.readColors(canvas.nativeElement, resolvedTheme);
    this.drawCanvas();
  });

  private readonly synchronizeDrawingState = effect(() => {
    const canvas = this.canvas();
    const paused = this.paused();

    if (!canvas) {
      return;
    }

    this.canvasDirty = true;

    if (paused || this.document.hidden) {
      this.stopDrawing();
      return;
    }

    this.startDrawing();
  });

  protected togglePaused(): void {
    this.paused.update((paused) => !paused);
  }

  protected formatTimestamp(timestampMs: number): string {
    return `${(timestampMs / 1_000).toFixed(1)} s`;
  }

  protected formatVelocity(value: number): string {
    return `${value.toFixed(2)} m/s`;
  }

  protected formatPressure(value: number): string {
    return `${value.toFixed(1)} bar`;
  }

  protected formatTemperature(value: number): string {
    return `${value.toFixed(1)} °C`;
  }

  private acceptFrame(frame: TelemetryFrame): void {
    this.canvasDirty = true;
    this.frameBuffer[this.writeIndex] = frame;
    this.writeIndex = (this.writeIndex + 1) % FRAME_BUFFER_SIZE;
    this.bufferedFrameCount = Math.min(FRAME_BUFFER_SIZE, this.bufferedFrameCount + 1);
    this.receivedCount += 1;
    this.downSampleCount += 1;

    if (this.downSampleCount === DOWN_SAMPLE_EVERY) {
      this.downSampleCount = 0;
      const readings = this.latestReadings();
      const nextReadings = readings.slice(Math.max(0, readings.length - MAX_LATEST_READINGS + 1));
      nextReadings.push(frame);
      this.latestReadings.set(nextReadings);
    }

    const now = Date.now();

    if (now - this.lastSummaryUpdate >= SUMMARY_UPDATE_MS) {
      this.liveSummary.set(this.formatSummary(frame));
      this.lastSummaryUpdate = now;
    }
  }

  private formatSummary(frame: TelemetryFrame): string {
    return `Velocity ${frame.velocityMps.toFixed(2)} m/s, pressure ${frame.pressureBar.toFixed(1)} bar, temperature ${frame.temperatureC.toFixed(1)} °C.`;
  }

  private resizeCanvas(width?: number, height?: number): void {
    const canvas = this.canvas()?.nativeElement;

    if (!canvas) {
      return;
    }

    const measuredWidth = width ?? this.readCanvasWidth(canvas);
    const measuredHeight = height ?? this.readCanvasHeight(canvas);
    const cssWidth = Math.max(1, measuredWidth || DEFAULT_CANVAS_WIDTH);
    const cssHeight = Math.max(1, measuredHeight || DEFAULT_CANVAS_HEIGHT);
    this.canvasWidth = cssWidth;
    this.canvasHeight = cssHeight;

    const context = canvas.getContext('2d');

    if (!context) {
      this.context = null;
      return;
    }

    this.context = context;
    this.devicePixelRatio = setupHiDpiCanvas(
      canvas,
      context,
      cssWidth,
      cssHeight,
      this.window?.devicePixelRatio,
    );
    this.canvasDirty = true;
    this.drawCanvas();
  }

  private readCanvasWidth(canvas: HTMLCanvasElement): number {
    return canvas.clientWidth || canvas.getBoundingClientRect().width;
  }

  private readCanvasHeight(canvas: HTMLCanvasElement): number {
    return canvas.clientHeight || canvas.getBoundingClientRect().height;
  }

  private readColors(canvas: HTMLCanvasElement, resolvedTheme: 'light' | 'dark'): void {
    const styles = this.window?.getComputedStyle(this.document.documentElement);

    if (!styles) {
      return;
    }

    this.colors.background = readThemeToken(
      styles,
      resolvedTheme === 'dark' ? '--color-surface' : '--color-bg',
    );
    this.colors.center = readThemeToken(styles, '--color-text-muted');
    this.colors.grid = readThemeToken(styles, '--color-border');
    this.colors.waveform = readThemeToken(styles, '--color-chart-1');
    canvas.dataset['theme'] = resolvedTheme;
  }

  private startDrawing(): void {
    if (
      !this.window?.requestAnimationFrame ||
      this.animationFrameId !== null ||
      this.document.hidden ||
      this.paused()
    ) {
      return;
    }

    this.fpsWindowStart = null;
    this.drawCountInWindow = 0;
    this.animationFrameId = this.window.requestAnimationFrame(this.renderFrame);
  }

  private stopDrawing(): void {
    if (this.animationFrameId !== null) {
      this.window?.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.framesReceived.set(this.receivedCount);
  }

  private handleVisibilityChange(): void {
    if (this.document.hidden) {
      this.stopDrawing();
      return;
    }

    if (!this.paused()) {
      this.startDrawing();
    }
  }

  // In zoneless Angular, this rAF callback stays outside change detection; only the throttled health signal updates the view.
  private readonly renderFrame = (timestamp: number): void => {
    this.animationFrameId = null;

    if (this.paused() || this.document.hidden) {
      return;
    }

    if (this.canvasDirty) {
      this.drawCanvas();
    }
    this.drawCountInWindow += 1;

    if (this.fpsWindowStart === null) {
      this.fpsWindowStart = timestamp;
    }

    const elapsed = timestamp - this.fpsWindowStart;

    if (elapsed >= HEALTH_UPDATE_MS) {
      this.drawFps.set(Math.round((this.drawCountInWindow * 1_000) / elapsed));
      this.framesReceived.set(this.receivedCount);
      this.fpsWindowStart = timestamp;
      this.drawCountInWindow = 0;
    }

    if (!this.paused() && !this.document.hidden) {
      this.animationFrameId = this.window?.requestAnimationFrame(this.renderFrame) ?? null;
    }
  };

  private drawCanvas(): void {
    const context = this.context;

    if (!context) {
      return;
    }

    const width = this.canvasWidth;
    const height = this.canvasHeight;
    const midpoint = height / 2;
    const amplitudeScale = height * 0.38;
    const frameCount = this.bufferedFrameCount;

    context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (this.colors.background) {
      context.fillStyle = this.colors.background;
      context.beginPath();
      context.rect(0, 0, width, height);
      context.fill();
    }

    context.strokeStyle = this.colors.grid;
    context.lineWidth = 1;
    context.globalAlpha = 0.55;
    context.beginPath();

    for (let division = 1; division < 4; division += 1) {
      const x = (width * division) / 4;
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }

    for (let division = 1; division < 4; division += 1) {
      const y = (height * division) / 4;
      context.moveTo(0, y);
      context.lineTo(width, y);
    }

    context.stroke();
    context.globalAlpha = 1;
    context.strokeStyle = this.colors.center;
    context.beginPath();
    context.moveTo(0, midpoint);
    context.lineTo(width, midpoint);
    context.stroke();

    if (frameCount === 0) {
      this.canvasDirty = false;
      return;
    }

    const traceCount = Math.min(frameCount, TRACE_PERSISTENCE);

    context.strokeStyle = this.colors.waveform;
    context.lineJoin = 'round';
    context.lineCap = 'round';

    for (let tracePosition = 0; tracePosition < traceCount; tracePosition += 1) {
      const frameIndex =
        (this.writeIndex - traceCount + tracePosition + FRAME_BUFFER_SIZE) % FRAME_BUFFER_SIZE;
      const frame = this.frameBuffer[frameIndex];

      if (!frame || frame.ultrasound.length === 0) {
        continue;
      }

      const newest = tracePosition === traceCount - 1;
      const sampleCount = frame.ultrasound.length;

      context.globalAlpha = newest ? 1 : (0.3 * (tracePosition + 1)) / traceCount;
      context.lineWidth = newest ? 2 : 1;
      context.beginPath();

      for (let sample = 0; sample < sampleCount; sample += 1) {
        const amplitude = frame.ultrasound[sample] ?? 0;
        const x = (sample / Math.max(1, sampleCount - 1)) * width;
        const y = midpoint - amplitude * amplitudeScale;

        if (sample === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.stroke();
    }

    context.globalAlpha = 1;
    this.canvasDirty = false;
  }
}
