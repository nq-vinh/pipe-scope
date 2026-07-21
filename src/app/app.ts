import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { Icon } from './shared/ui/icon/icon';
import { ThemeSwitch } from './shared/ui/theme-switch/theme-switch';

@Component({
  selector: 'app-root',
  imports: [Icon, RouterLink, RouterLinkActive, RouterOutlet, ThemeSwitch],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'app-shell',
  },
})
export class App {
  private readonly router = inject(Router);
  private readonly main = viewChild<ElementRef<HTMLElement>>('main');
  private readonly navigationEnd = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    ),
    { initialValue: null },
  );

  private readonly focusContent = effect(() => {
    const navigationEnd = this.navigationEnd();
    const main = this.main();

    if (navigationEnd && navigationEnd.id > 1 && main) {
      queueMicrotask(() => main.nativeElement.focus());
    }
  });
}
