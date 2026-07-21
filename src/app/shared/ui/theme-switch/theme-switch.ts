import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ThemeService } from '../../../core/theme';

@Component({
  selector: 'app-theme-switch',
  templateUrl: './theme-switch.html',
  styleUrl: './theme-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'theme-switch-host',
  },
})
export class ThemeSwitch {
  protected readonly theme = inject(ThemeService);
}
