import { TestBed } from '@angular/core/testing';

import { ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.removeItem('pipescope-theme');
    delete document.documentElement.dataset['theme'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['theme'];
  });

  it.each([
    [false, 'light'],
    [true, 'dark'],
  ] as const)('defaults to the OS %s preference', (systemDark, expectedTheme) => {
    const theme = createTheme(systemDark);

    expect(theme.resolved()).toBe(expectedTheme);
    expect(document.documentElement.dataset['theme']).toBe(expectedTheme);
    expect(localStorage.getItem('pipescope-theme')).toBeNull();
  });

  it('stores an explicit override and removes it when toggled back to the OS value', () => {
    const theme = createTheme(false);

    theme.toggle();
    TestBed.flushEffects();

    expect(theme.resolved()).toBe('dark');
    expect(localStorage.getItem('pipescope-theme')).toBe('dark');

    theme.toggle();
    TestBed.flushEffects();

    expect(theme.resolved()).toBe('light');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('pipescope-theme')).toBeNull();
  });

  it('persists an explicit override for a new service instance', () => {
    const theme = createTheme(false);

    theme.toggle();
    TestBed.flushEffects();
    TestBed.resetTestingModule();

    stubMatchMedia(false);
    TestBed.configureTestingModule({ providers: [ThemeService] });
    const restoredTheme = TestBed.inject(ThemeService);
    TestBed.flushEffects();

    expect(restoredTheme.resolved()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
  });
});

function createTheme(systemDark: boolean): ThemeService {
  stubMatchMedia(systemDark);
  TestBed.configureTestingModule({ providers: [ThemeService] });
  const theme = TestBed.inject(ThemeService);
  TestBed.flushEffects();
  return theme;
}

function stubMatchMedia(systemDark: boolean): void {
  const mediaQuery = {
    matches: systemDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList;

  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mediaQuery),
  );
}
