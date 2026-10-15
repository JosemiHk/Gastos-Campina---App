import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from './auth';
export const authenticated: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureReady();
  return auth.user() ? true : router.createUrlTree(['/acceso']);
};
export const guest: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  await auth.ensureReady();
  return auth.user() ? router.createUrlTree(['/resumen']) : true;
};
