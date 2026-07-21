import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'runs',
  },
  {
    path: 'runs',
    title: 'Inspection Runs',
    loadComponent: () =>
      import('./features/runs-overview/runs-overview').then(({ RunsOverview }) => RunsOverview),
  },
  {
    path: 'runs/:runId',
    title: 'Run Details',
    loadComponent: () =>
      import('./features/run-detail/run-detail').then(({ RunDetail }) => RunDetail),
  },
  {
    path: 'live',
    title: 'Live Monitor',
    loadComponent: () =>
      import('./features/live-monitor/live-monitor').then(({ LiveMonitor }) => LiveMonitor),
  },
  {
    path: 'design-system',
    title: 'Design System',
    loadComponent: () =>
      import('./features/design-system/design-system').then(({ DesignSystem }) => DesignSystem),
  },
  {
    path: '**',
    redirectTo: 'runs',
  },
];
