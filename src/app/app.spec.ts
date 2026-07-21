import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { App } from './app';
import { appConfig } from './app.config';

const routeCases = [
  ['/runs', 'Inspection runs', 'Inspection Runs · PipeScope', 'Runs'],
  ['/runs/run-20260720-1', 'run-20260720-1', 'Run Details · PipeScope', 'Runs'],
  ['/live', 'Live monitor', 'Live Monitor · PipeScope', 'Live'],
  ['/design-system', 'Design system', 'Design System · PipeScope', 'Design system'],
] as const;

describe('App', () => {
  beforeEach(async () => {
    localStorage.removeItem('pipescope-theme');

    await TestBed.configureTestingModule({
      imports: [App],
      providers: appConfig.providers,
    }).compileComponents();
  });

  it('renders the accessible application shell', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/runs');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const skipLink = element.querySelector<HTMLAnchorElement>('.skip-link');

    expect(skipLink?.getAttribute('href')).toBe('#main');
    expect(element.querySelector('.brand')?.textContent).toContain('PipeScope');
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Primary navigation');
    expect(element.querySelector('app-theme-switch button')).toBeTruthy();
    expect(element.querySelector('main')?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).not.toBe(element.querySelector('main'));

    await router.navigateByUrl('/live');
    await fixture.whenStable();
    await new Promise<void>(queueMicrotask);

    expect(document.activeElement).toBe(element.querySelector('main'));
  });

  it.each(routeCases)(
    'renders %s with its route title',
    async (path, heading, title, activeLink) => {
      const fixture = TestBed.createComponent(App);
      const router = TestBed.inject(Router);

      await router.navigateByUrl(path);
      await fixture.whenStable();

      const element = fixture.nativeElement as HTMLElement;

      expect(element.querySelector('main h1')?.textContent).toBe(heading);
      expect(document.title).toBe(title);
      expect(
        element.querySelector<HTMLAnchorElement>('a[aria-current="page"]')?.textContent?.trim(),
      ).toBe(activeLink);
    },
  );

  it('toggles the theme and clears an override when it returns to the OS value', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/runs');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const themeToggle = element.querySelector<HTMLButtonElement>('app-theme-switch button');

    themeToggle?.click();
    await fixture.whenStable();

    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('pipescope-theme')).toBe('dark');

    themeToggle?.click();
    await fixture.whenStable();

    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('pipescope-theme')).toBeNull();
  });
});
