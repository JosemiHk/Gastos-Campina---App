import { inject, Injector } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { HouseholdStore } from '../data-access/household-store';
export const unsavedChanges: CanDeactivateFn<unknown> = async () => {
  const store = inject(HouseholdStore);
  const injector = inject(Injector);
  if (store.saving() || store.uploading()) return false;
  if (!store.hasUnsavedChanges()) return true;
  const { Confirm } = await import('../shared/ui/confirm-dialog');
  return injector.get(Confirm).ask({
    title: 'Hay cambios sin guardar',
    message: 'Si sales ahora, los cambios de este formulario se perderán.',
    action: 'Salir sin guardar',
  });
};
