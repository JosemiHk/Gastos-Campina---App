import { Routes } from '@angular/router';
import { authenticated, guest } from './core/guards';
import { unsavedChanges } from './core/unsaved-guard';

const authPage = () => import('./features/auth/auth-page').then((m) => m.AuthPage);
export const routes: Routes = [
  {
    path: 'acceso',
    pathMatch: 'full',
    canActivate: [guest],
    loadComponent: authPage,
    data: { mode: 'login' },
    title: 'Ingresar · Campiña Gastos',
  },
  {
    path: 'acceso/verificar',
    canActivate: [guest],
    loadComponent: authPage,
    data: { mode: 'verify' },
    title: 'Verificar código · Campiña Gastos',
  },
  {
    path: 'acceso/recuperar',
    canActivate: [guest],
    loadComponent: authPage,
    data: { mode: 'recover' },
    title: 'Recuperar acceso · Campiña Gastos',
  },
  {
    path: 'acceso/enlace-enviado',
    loadComponent: authPage,
    data: { mode: 'sent' },
    title: 'Enlace enviado · Campiña Gastos',
  },
  {
    path: 'acceso/confirmar',
    loadComponent: authPage,
    data: { mode: 'callback' },
    title: 'Confirmar acceso · Campiña Gastos',
  },
  {
    path: '',
    canActivate: [authenticated],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      {
        path: 'resumen',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
        title: 'Resumen mensual · Campiña Gastos',
      },
      {
        path: 'registrar',
        canDeactivate: [unsavedChanges],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadComponent: () => import('./features/receipts/receipt-page').then((m) => m.ReceiptPage),
        title: 'Registrar recibo · Campiña Gastos',
      },
      {
        path: 'calculo',
        loadComponent: () =>
          import('./features/distribution/distribution-page').then((m) => m.DistributionPage),
        title: 'Cálculo de distribución · Campiña Gastos',
      },
      {
        path: 'historial',
        loadComponent: () => import('./features/history/history-page').then((m) => m.HistoryPage),
        title: 'Historial mensual · Campiña Gastos',
      },
      {
        path: 'configuracion',
        canDeactivate: [unsavedChanges],
        runGuardsAndResolvers: 'paramsOrQueryParamsChange',
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
        title: 'Reglas y configuración · Campiña Gastos',
      },
      {
        path: 'compartir',
        loadComponent: () => import('./features/summary/summary-page').then((m) => m.SummaryPage),
        title: 'Resumen WhatsApp · Campiña Gastos',
      },
      { path: '', pathMatch: 'full', redirectTo: 'resumen' },
      { path: '**', redirectTo: 'resumen' },
    ],
  },
];
