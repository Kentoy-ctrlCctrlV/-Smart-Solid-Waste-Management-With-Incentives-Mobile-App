import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./login/login').then((module) => module.Login) },
  { path: 'dashboard', loadComponent: () => import('./dashboard/dashboard').then((module) => module.Dashboard) },
  { path: '**', redirectTo: '/login' }
];
