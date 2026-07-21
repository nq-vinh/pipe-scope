import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { RouterLink } from '@angular/router';

export type DataTableCell = string | number;
export type DataTableSortDirection = 'asc' | 'desc';

export interface DataTableSort {
  readonly columnId: string;
  readonly direction: DataTableSortDirection;
}

export interface DataTableColumn<T> {
  readonly id: string;
  readonly header: string;
  readonly cell: (row: T) => DataTableCell;
  readonly sortComparator?: (first: T, second: T) => number;
  readonly align?: 'start' | 'end';
}

@Component({
  selector: 'app-data-table',
  imports: [RouterLink],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'data-table-host',
  },
})
export class DataTable<T> {
  readonly caption = input.required<string>();
  readonly columns = input.required<readonly DataTableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  readonly rowKey = input.required<(row: T) => string | number>();
  readonly rowLink = input<((row: T) => string) | null>(null);
  readonly rowLabel = input<((row: T) => string) | null>(null);
  readonly emptyMessage = input('No data available.');
  readonly sort = model<DataTableSort | null>(null);

  protected readonly sortedRows = computed<readonly T[]>(() => {
    const activeSort = this.sort();
    const rows = this.rows();

    if (!activeSort) {
      return rows;
    }

    const column = this.columns().find((candidate) => candidate.id === activeSort.columnId);

    const comparator = column?.sortComparator;

    if (!comparator) {
      return rows;
    }

    const direction = activeSort.direction === 'asc' ? 1 : -1;
    return rows
      .map((row, index) => ({ row, index }))
      .sort(
        (first, second) =>
          comparator(first.row, second.row) * direction || first.index - second.index,
      )
      .map(({ row }) => row);
  });

  protected toggleSort(column: DataTableColumn<T>): void {
    if (!column.sortComparator) {
      return;
    }

    const activeSort = this.sort();
    const direction =
      activeSort?.columnId === column.id && activeSort.direction === 'asc' ? 'desc' : 'asc';
    this.sort.set({ columnId: column.id, direction });
  }

  protected ariaSort(column: DataTableColumn<T>): 'ascending' | 'descending' | 'none' | null {
    if (!column.sortComparator) {
      return null;
    }

    const activeSort = this.sort();

    if (activeSort?.columnId !== column.id) {
      return 'none';
    }

    return activeSort.direction === 'asc' ? 'ascending' : 'descending';
  }

  protected activateRow(event: MouseEvent): void {
    if (!this.rowLink()) {
      return;
    }

    const target = event.target;
    const row = event.currentTarget;

    if (!(target instanceof Element) || !(row instanceof HTMLTableRowElement)) {
      return;
    }

    if (!target.closest('a')) {
      row.querySelector<HTMLAnchorElement>('a[data-row-link]')?.click();
    }
  }
}
