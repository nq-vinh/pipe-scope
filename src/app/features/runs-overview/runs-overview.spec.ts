import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { generateAnomalies } from '../../core/inspection-data';
import { InspectionStore } from '../../core/inspection-store';
import { RunsOverview } from './runs-overview';

describe('RunsOverview', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunsOverview],
      providers: [InspectionStore, provideRouter([])],
    }).compileComponents();
  });

  it('renders every seeded run in the shared table', async () => {
    const fixture = TestBed.createComponent(RunsOverview);
    const store = TestBed.inject(InspectionStore);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(tableRows(fixture)).toHaveLength(store.runs().length);
    expect(runIds(fixture)).toEqual(store.runs().map((run) => run.id));
  });

  it('narrows visible rows when a user types in the search filter', async () => {
    const fixture = TestBed.createComponent(RunsOverview);
    const store = TestBed.inject(InspectionStore);
    const firstRun = store.runs()[0];

    if (!firstRun) {
      throw new Error('Expected a seeded inspection run.');
    }

    fixture.detectChanges();
    await fixture.whenStable();

    const search = rootElement(fixture).querySelector<HTMLInputElement>('#run-search');

    if (!search) {
      throw new Error('Expected the segment search input.');
    }

    search.value = firstRun.segment.name;
    search.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();

    const expectedRuns = store
      .runs()
      .filter((run) => run.segment.name.includes(firstRun.segment.name));

    expect(tableRows(fixture)).toHaveLength(expectedRuns.length);
    expect(runIds(fixture)).toEqual(expectedRuns.map((run) => run.id));
    expect(expectedRuns.length).toBeLessThan(store.runs().length);
  });

  it('filters rendered rows by minimum severity', async () => {
    const fixture = TestBed.createComponent(RunsOverview);
    const store = TestBed.inject(InspectionStore);

    fixture.detectChanges();
    await fixture.whenStable();

    const severity = rootElement(fixture).querySelector<HTMLSelectElement>('#minimum-severity');

    if (!severity) {
      throw new Error('Expected the minimum severity filter.');
    }

    severity.value = 'critical';
    severity.dispatchEvent(new Event('change', { bubbles: true }));
    await fixture.whenStable();

    const expectedRuns = store
      .runs()
      .filter((run) =>
        generateAnomalies(run.id).some((anomaly) => anomaly.severity === 'critical'),
      );

    expect(runIds(fixture)).toEqual(expectedRuns.map((run) => run.id));
    expect(tableRows(fixture)).toHaveLength(expectedRuns.length);
    expect(expectedRuns.length).toBeLessThan(store.runs().length);
  });

  it('toggles sortable row order and aria-sort', async () => {
    const fixture = TestBed.createComponent(RunsOverview);

    fixture.detectChanges();
    await fixture.whenStable();

    const anomalyHeader = Array.from(
      rootElement(fixture).querySelectorAll<HTMLButtonElement>('thead button'),
    ).find((button) => button.textContent?.includes('Anomalies'));

    if (!anomalyHeader) {
      throw new Error('Expected the sortable anomaly header.');
    }

    expect(anomalyHeader.parentElement?.getAttribute('aria-sort')).toBe('none');

    anomalyHeader.click();
    await fixture.whenStable();

    const ascending = anomalyCounts(fixture);
    expect(anomalyHeader.parentElement?.getAttribute('aria-sort')).toBe('ascending');
    expect(ascending).toEqual([...ascending].sort((first, second) => first - second));

    anomalyHeader.click();
    await fixture.whenStable();

    const descending = anomalyCounts(fixture);
    expect(anomalyHeader.parentElement?.getAttribute('aria-sort')).toBe('descending');
    expect(descending).toEqual([...descending].sort((first, second) => second - first));
  });
});

function tableRows(fixture: ComponentFixture<RunsOverview>): HTMLTableRowElement[] {
  return Array.from(rootElement(fixture).querySelectorAll<HTMLTableRowElement>('tbody tr'));
}

function runIds(fixture: ComponentFixture<RunsOverview>): string[] {
  return tableRows(fixture).map((row) => row.querySelector('a')?.textContent?.trim() ?? '');
}

function anomalyCounts(fixture: ComponentFixture<RunsOverview>): number[] {
  return tableRows(fixture).map((row) => Number(row.cells[4]?.textContent?.trim()));
}

function rootElement(fixture: ComponentFixture<RunsOverview>): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}
