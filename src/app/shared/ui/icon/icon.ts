import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type IconName = 'arrow' | 'sort' | 'pause' | 'play' | 'warning' | 'pipeline';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[style.--icon-size.px]': 'size()',
  },
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly label = input<string | null>(null);
  readonly size = input(20);
}
