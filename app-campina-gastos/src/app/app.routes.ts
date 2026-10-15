import { Routes } from '@angular/router';
import { guest } from './core/guards';

const authPage = () => import('./features/auth/auth-page').then(m => m.AuthPage);
export const routes: Routes = [
  { path: 'acceso', pathMatch: 'full', canActivate: [guest], loadComponent: authPage, data: { mode: 'login' }, title: 'Ingresar · Campiña Gastos' },
  { path: 'acceso/verificar', canActivate: [guest], loadComponent: authPage, data: { mode: 'verify' }, title: 'Verificar código · Campiña Gastos' },
  { path: 'acceso/recuperar', canActivate: [guest], loadComponent: authPage, data: { mode: 'recover' }, title: 'Recuperar acceso · Campiña Gastos' },
  { path: 'acceso/enlace-enviado', loadComponent: authPage, data: { mode: 'sent' }, title: 'Enlace enviado · Campiña Gastos' },
  { path: 'acceso/confirmar', loadComponent: authPage, data: { mode: 'callback' }, title: 'Confirmar acceso · Campiña Gastos' },
  { path: '**', redirectTo: 'acceso' },
];
