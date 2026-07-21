import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Severity } from '../../../core/models';

@Component({
  selector: 'app-badge',
  templateUrl: './badge.html',
  styleUrl: './badge.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-severity]': 'severity()',
  },
})
export class Badge {
  readonly severity = input.required<Severity>();
}
