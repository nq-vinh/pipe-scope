import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CardVariant = 'default' | 'raised';

@Component({
  selector: 'app-card',
  templateUrl: './card.html',
  styleUrl: './card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.is-raised]': "variant() === 'raised'",
  },
})
export class Card {
  readonly variant = input<CardVariant>('default');
}
