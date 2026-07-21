import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { clamp } from '../../core/random';
import { Anomaly, SEVERITY_RANK, Severity } from '../../core/models';
import { readThemeToken, ThemeService } from '../../core/theme';
import { Heatmap } from '../run-detail/heatmap/heatmap';
import { Badge } from '../../shared/ui/badge/badge';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { DataTable, DataTableColumn, DataTableSort } from '../../shared/ui/data-table/data-table';
import { Icon } from '../../shared/ui/icon/icon';
import { ThemeSwitch } from '../../shared/ui/theme-switch/theme-switch';

interface ColorTokenDefinition {
  readonly name: string;
  readonly label: string;
  readonly contrastForeground: string;
  readonly contrastBackground: string;
  readonly contrastLabel: string;
  readonly target: string;
}

interface ColorToken extends ColorTokenDefinition {
  readonly value: string;
  readonly contrast: number | null;
}

interface ColorTokenGroupDefinition {
  readonly title: string;
  readonly tokens: readonly ColorTokenDefinition[];
}

interface ColorTokenGroup extends ColorTokenGroupDefinition {
  readonly tokens: readonly ColorToken[];
}

interface ScaleToken {
  readonly name: string;
  readonly label: string;
  readonly sample: string;
}

interface SpacingToken {
  readonly name: string;
  readonly label: string;
}

interface SeverityLegendItem {
  readonly severity: Severity;
  readonly label: string;
  readonly description: string;
}

interface DemoRow {
  readonly id: string;
  readonly signal: string;
  readonly severity: Severity;
  readonly reading: string;
}

interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

const COLOR_GROUPS: readonly ColorTokenGroupDefinition[] = [
  {
    title: 'Foundations',
    tokens: [
      {
        name: '--color-bg',
        label: 'Background',
        contrastForeground: '--color-text',
        contrastBackground: '--color-bg',
        contrastLabel: 'Text on background',
        target: '4.5:1 text',
      },
      {
        name: '--color-surface',
        label: 'Surface',
        contrastForeground: '--color-text',
        contrastBackground: '--color-surface',
        contrastLabel: 'Text on surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-surface-raised',
        label: 'Raised surface',
        contrastForeground: '--color-text',
        contrastBackground: '--color-surface-raised',
        contrastLabel: 'Text on raised surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-border',
        label: 'Border',
        contrastForeground: '--color-border',
        contrastBackground: '--color-bg',
        contrastLabel: 'Border on background',
        target: '3:1 UI',
      },
    ],
  },
  {
    title: 'Content and interaction',
    tokens: [
      {
        name: '--color-text',
        label: 'Text',
        contrastForeground: '--color-text',
        contrastBackground: '--color-bg',
        contrastLabel: 'Text on background',
        target: '4.5:1 text',
      },
      {
        name: '--color-text-muted',
        label: 'Muted text',
        contrastForeground: '--color-text-muted',
        contrastBackground: '--color-bg',
        contrastLabel: 'Muted text on background',
        target: '4.5:1 text',
      },
      {
        name: '--color-accent',
        label: 'Accent',
        contrastForeground: '--color-accent',
        contrastBackground: '--color-bg',
        contrastLabel: 'Accent on background',
        target: '4.5:1 text',
      },
      {
        name: '--color-accent-contrast',
        label: 'Accent contrast',
        contrastForeground: '--color-accent-contrast',
        contrastBackground: '--color-accent',
        contrastLabel: 'Contrast on accent',
        target: '4.5:1 text',
      },
      {
        name: '--color-focus',
        label: 'Focus ring',
        contrastForeground: '--color-focus',
        contrastBackground: '--color-bg',
        contrastLabel: 'Focus ring on background',
        target: '3:1 UI',
      },
    ],
  },
  {
    title: 'Severity and chart colors',
    tokens: [
      {
        name: '--color-severity-low',
        label: 'Low severity',
        contrastForeground: '--color-severity-low',
        contrastBackground: '--color-severity-low-surface',
        contrastLabel: 'Low on low surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-low-surface',
        label: 'Low surface',
        contrastForeground: '--color-text',
        contrastBackground: '--color-severity-low-surface',
        contrastLabel: 'Text on low surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-medium',
        label: 'Medium severity',
        contrastForeground: '--color-severity-medium',
        contrastBackground: '--color-severity-medium-surface',
        contrastLabel: 'Medium on medium surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-medium-surface',
        label: 'Medium surface',
        contrastForeground: '--color-text',
        contrastBackground: '--color-severity-medium-surface',
        contrastLabel: 'Text on medium surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-high',
        label: 'High severity',
        contrastForeground: '--color-severity-high',
        contrastBackground: '--color-severity-high-surface',
        contrastLabel: 'High on high surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-high-surface',
        label: 'High surface',
        contrastForeground: '--color-text',
        contrastBackground: '--color-severity-high-surface',
        contrastLabel: 'Text on high surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-critical',
        label: 'Critical severity',
        contrastForeground: '--color-severity-critical',
        contrastBackground: '--color-severity-critical-surface',
        contrastLabel: 'Critical on critical surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-severity-critical-surface',
        label: 'Critical surface',
        contrastForeground: '--color-text',
        contrastBackground: '--color-severity-critical-surface',
        contrastLabel: 'Text on critical surface',
        target: '4.5:1 text',
      },
      {
        name: '--color-chart-1',
        label: 'Chart one',
        contrastForeground: '--color-chart-1',
        contrastBackground: '--color-bg',
        contrastLabel: 'Chart one on background',
        target: '3:1 UI',
      },
      {
        name: '--color-chart-2',
        label: 'Chart two',
        contrastForeground: '--color-chart-2',
        contrastBackground: '--color-bg',
        contrastLabel: 'Chart two on background',
        target: '3:1 UI',
      },
      {
        name: '--color-chart-3',
        label: 'Chart three',
        contrastForeground: '--color-chart-3',
        contrastBackground: '--color-bg',
        contrastLabel: 'Chart three on background',
        target: '3:1 UI',
      },
      {
        name: '--color-chart-4',
        label: 'Chart four',
        contrastForeground: '--color-chart-4',
        contrastBackground: '--color-bg',
        contrastLabel: 'Chart four on background',
        target: '3:1 UI',
      },
    ],
  },
];

const TYPE_SCALE: readonly ScaleToken[] = [
  { name: '--font-size-xs', label: 'Extra small', sample: 'Metadata and labels' },
  { name: '--font-size-sm', label: 'Small', sample: 'Supporting text and controls' },
  { name: '--font-size-md', label: 'Body', sample: 'Readable interface body copy' },
  { name: '--font-size-lg', label: 'Large', sample: 'Page introductions' },
  { name: '--font-size-xl', label: 'Heading', sample: 'Section heading' },
  { name: '--font-size-2xl', label: 'Display', sample: 'Page title' },
];

const SPACING_SCALE: readonly SpacingToken[] = [
  { name: '--space-1', label: '1 · 0.25rem' },
  { name: '--space-2', label: '2 · 0.5rem' },
  { name: '--space-3', label: '3 · 0.75rem' },
  { name: '--space-4', label: '4 · 1rem' },
  { name: '--space-5', label: '5 · 1.5rem' },
  { name: '--space-6', label: '6 · 2rem' },
  { name: '--space-7', label: '7 · 3rem' },
];

const SEVERITY_LEGEND: readonly SeverityLegendItem[] = [
  { severity: 'low', label: 'Low', description: 'Routine review' },
  { severity: 'medium', label: 'Medium', description: 'Planned follow-up' },
  { severity: 'high', label: 'High', description: 'Prioritised review' },
  { severity: 'critical', label: 'Critical', description: 'Immediate engineering attention' },
];

@Component({
  selector: 'app-design-system',
  imports: [Badge, Button, Card, DataTable, Icon, ThemeSwitch, Heatmap],
  templateUrl: './design-system.html',
  styleUrl: './design-system.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'feature-page',
  },
})
export class DesignSystem {
  private readonly document = inject(DOCUMENT);
  private readonly theme = inject(ThemeService);

  readonly typeScale = TYPE_SCALE;
  readonly spacingScale = SPACING_SCALE;
  readonly severityLegend = SEVERITY_LEGEND;
  readonly demoSort = signal<DataTableSort | null>(null);
  readonly buttonMessage = signal('Ready for an action.');
  readonly demoRowKey = (row: DemoRow): string => row.id;
  readonly demoAnomaly: Anomaly = {
    id: 'design-system-anomaly',
    runId: 'design-system',
    distanceM: 12_480,
    type: 'metal-loss',
    severity: 'high',
    confidence: 0.91,
    depthPct: 38.4,
    lengthMm: 46,
    widthMm: 21,
    clockPosition: 4,
  };
  readonly demoRows: readonly DemoRow[] = [
    { id: 'sensor-01', signal: 'Velocity', severity: 'low', reading: '1.52 m/s' },
    { id: 'sensor-02', signal: 'Pressure', severity: 'medium', reading: '64.8 bar' },
    { id: 'sensor-03', signal: 'Ultrasound', severity: 'high', reading: '0.91 peak' },
  ];
  readonly demoColumns: readonly DataTableColumn<DemoRow>[] = [
    {
      id: 'signal',
      header: 'Signal',
      cell: (row) => row.signal,
      sortComparator: (first, second) => first.signal.localeCompare(second.signal),
    },
    {
      id: 'severity',
      header: 'Severity',
      cell: (row) => row.severity,
      sortComparator: (first, second) =>
        SEVERITY_RANK[first.severity] - SEVERITY_RANK[second.severity],
    },
    {
      id: 'reading',
      header: 'Latest reading',
      cell: (row) => row.reading,
    },
  ];

  readonly colorGroups = computed<readonly ColorTokenGroup[]>(() => {
    this.theme.resolved();
    const styles = this.document.defaultView?.getComputedStyle(this.document.documentElement);

    return COLOR_GROUPS.map((group) => ({
      ...group,
      tokens: group.tokens.map((token) => {
        const value = readThemeToken(styles, token.name);
        const foreground = readThemeToken(styles, token.contrastForeground);
        const background = readThemeToken(styles, token.contrastBackground);

        return {
          ...token,
          value: value || 'Unavailable',
          contrast: contrastRatio(foreground, background),
        };
      }),
    }));
  });

  protected formatContrast(value: number | null): string {
    return value === null ? 'Unavailable' : `${value.toFixed(2)}:1`;
  }

  protected acknowledgeButton(): void {
    this.buttonMessage.set('Primary action triggered.');
  }
}

function contrastRatio(foreground: string, background: string): number | null {
  const foregroundColor = parseColor(foreground);
  const backgroundColor = parseColor(background);

  if (!foregroundColor || !backgroundColor) {
    return null;
  }

  const foregroundLuminance = relativeLuminance(foregroundColor);
  const backgroundLuminance = relativeLuminance(backgroundColor);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: RgbColor): number {
  const red = linearize(color.red / 255);
  const green = linearize(color.green / 255);
  const blue = linearize(color.blue / 255);

  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function linearize(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function parseColor(value: string): RgbColor | null {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith('#')) {
    return parseHexColor(normalized.slice(1));
  }

  const rgbMatch = /^rgba?\((.*)\)$/.exec(normalized);
  const components = rgbMatch?.[1]?.split(/[,\s/]+/).slice(0, 3) ?? [];
  const red = parseColorChannel(components[0]);
  const green = parseColorChannel(components[1]);
  const blue = parseColorChannel(components[2]);

  return red === null || green === null || blue === null ? null : { red, green, blue };
}

function parseHexColor(value: string): RgbColor | null {
  if (![3, 4, 6, 8].includes(value.length) || !/^[\da-f]+$/i.test(value)) {
    return null;
  }

  const channelLength = value.length <= 4 ? 1 : 2;
  const red = value.slice(0, channelLength);
  const green = value.slice(channelLength, channelLength * 2);
  const blue = value.slice(channelLength * 2, channelLength * 3);

  return {
    red: parseHexChannel(red),
    green: parseHexChannel(green),
    blue: parseHexChannel(blue),
  };
}

function parseHexChannel(value: string): number {
  const expanded = value.length === 1 ? value + value : value;
  return Number.parseInt(expanded, 16);
}

function parseColorChannel(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  if (value.endsWith('%')) {
    const percentage = Number.parseFloat(value.slice(0, -1));
    return Number.isFinite(percentage) ? clamp(percentage * 2.55, 0, 255) : null;
  }

  const channel = Number.parseFloat(value);
  return Number.isFinite(channel) ? clamp(channel, 0, 255) : null;
}
