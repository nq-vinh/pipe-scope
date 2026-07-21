import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThemeService } from '../../../core/theme';
import { ThemeSwitch } from './theme-switch';

describe('ThemeSwitch', () => {
  let fixture: ComponentFixture<ThemeSwitch>;

  beforeEach(async () => {
    localStorage.removeItem('pipescope-theme');
    delete document.documentElement.dataset['theme'];
    stubMatchMedia(false);

    await TestBed.configureTestingModule({
      imports: [ThemeSwitch],
      providers: [ThemeService],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeSwitch);
    fixture.detectChanges();
    TestBed.flushEffects();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['theme'];
  });

  it('renders one accessible binary toggle with the portfolio icons', () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('button');

    expect(button?.type).toBe('button');
    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(button?.querySelector('.visually-hidden')?.textContent).toBe('Dark theme');
    expect(button?.querySelectorAll('svg')).toHaveLength(2);
    expect(button?.querySelector('.icon-sun')).toBeTruthy();
    expect(button?.querySelector('.icon-moon')).toBeTruthy();
  });

  it('flips the resolved theme and clears the override on the second toggle', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('button');

    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('pipescope-theme')).toBe('dark');

    button?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    TestBed.flushEffects();

    expect(button?.getAttribute('aria-pressed')).toBe('false');
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('pipescope-theme')).toBeNull();
  });
});

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
