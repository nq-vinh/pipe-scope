import { Injectable } from '@angular/core';
import { defer, interval, map, Observable } from 'rxjs';

import { TelemetryFrame } from './models';
import { PIPESCOPE_SEED } from './inspection-data';
import { clamp, createRng, range, round } from './random';

const FRAME_INTERVAL_MS = 25;
const ULTRASOUND_SAMPLES = 128;

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  readonly frames$: Observable<TelemetryFrame> = defer(() => {
    const rng = createRng(PIPESCOPE_SEED ^ 0x51f15e);
    let velocityMps = 1.55;
    let pressureBar = 64;
    let temperatureC = 31;

    return interval(FRAME_INTERVAL_MS).pipe(
      map((frameIndex) => {
        velocityMps = clamp(velocityMps + range(rng, -0.035, 0.035), 0.8, 2.5);
        pressureBar = clamp(pressureBar + range(rng, -0.4, 0.4), 40, 95);
        temperatureC = clamp(temperatureC + range(rng, -0.08, 0.08), 18, 54);

        const ultrasound = new Float32Array(ULTRASOUND_SAMPLES);
        const time = (frameIndex + 1) * FRAME_INTERVAL_MS;
        const phase = time / 190;

        for (let sample = 0; sample < ULTRASOUND_SAMPLES; sample += 1) {
          const position = sample / ULTRASOUND_SAMPLES;
          const carrier = Math.sin(position * Math.PI * 12 + phase) * 0.58;
          const harmonic = Math.sin(position * Math.PI * 29 - phase * 0.55) * 0.22;
          const pulse = Math.exp(-((position - 0.58) ** 2) / 0.004) * Math.sin(phase * 2.4) * 0.28;
          ultrasound[sample] = clamp(carrier + harmonic + pulse + range(rng, -0.08, 0.08), -1, 1);
        }

        return {
          timestampMs: time,
          velocityMps: round(velocityMps, 3),
          pressureBar: round(pressureBar, 2),
          temperatureC: round(temperatureC, 2),
          ultrasound,
        };
      }),
    );
  });
}
