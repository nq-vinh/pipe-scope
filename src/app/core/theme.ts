import { DOCUMENT } from '@angular/common';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

type ThemePreference = 'light' | 'system' | 'dark';
type ResolvedTheme = Exclude<ThemePreference, 'system'>;

const STORAGE_KEY = 'pipescope-theme';

export function readThemeToken(styles: CSSStyleDeclaration | undefined, name: string): string {
  return styles?.getPropertyValue(name).trim() ?? '';
}

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;
  private readonly mediaQuery = this.window?.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.mediaQuery?.matches ?? false);

  private readonly preference = signal<ThemePreference>(this.readPreference());
  readonly resolved = computed<ResolvedTheme>(() => {
    const preference = this.preference();
    return preference === 'system' ? (this.systemDark() ? 'dark' : 'light') : preference;
  });

  private readonly synchronizeTheme = effect((onCleanup) => {
    const preference = this.preference();
    const resolved = this.resolved();
    const updateSystemTheme = (event: MediaQueryListEvent): void =>
      this.systemDark.set(event.matches);

    this.document.documentElement.dataset['theme'] = resolved;

    this.persistPreference(preference);

    this.mediaQuery?.addEventListener('change', updateSystemTheme);
    onCleanup(() => this.mediaQuery?.removeEventListener('change', updateSystemTheme));
  });

  toggle(): void {
    const nextTheme: ResolvedTheme = this.resolved() === 'dark' ? 'light' : 'dark';
    const systemTheme: ResolvedTheme = this.systemDark() ? 'dark' : 'light';

    this.preference.set(nextTheme === systemTheme ? 'system' : nextTheme);
  }

  private readPreference(): ThemePreference {
    try {
      const stored = this.window?.localStorage.getItem(STORAGE_KEY);
      return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    } catch {
      return 'system';
    }
  }

  private persistPreference(preference: ThemePreference): void {
    try {
      if (preference === 'system') {
        this.window?.localStorage.removeItem(STORAGE_KEY);
      } else {
        this.window?.localStorage.setItem(STORAGE_KEY, preference);
      }
    } catch {
      return;
    }
  }
}
