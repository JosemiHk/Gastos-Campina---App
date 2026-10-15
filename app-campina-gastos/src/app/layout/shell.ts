import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Auth } from '../core/auth';
import { HouseholdStore } from '../data-access/household-store';
import { isMonth, monthLabel, monthNow } from '../domain/money';
import { Brand } from '../shared/ui/brand';
import { Icon } from '../shared/ui/icon';
import { Confirm } from '../shared/ui/confirm-dialog';
import { errorMessage } from '../core/errors';
@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    MatButtonModule,
    MatProgressSpinnerModule,
    Brand,
    Icon,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  readonly store = inject(HouseholdStore);
  readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly confirm = inject(Confirm);
  private readonly snack = inject(MatSnackBar);
  readonly monthLabel = monthLabel;
  readonly links = [
    { path: '/resumen', icon: 'grid', label: 'Resumen', desktop: 'Resumen mensual' },
    { path: '/registrar', icon: 'plus', label: 'Registrar', desktop: 'Registrar recibo' },
    { path: '/calculo', icon: 'calculator', label: 'Cálculo', desktop: 'Cálculo de distribución' },
    { path: '/historial', icon: 'calendar', label: 'Historial', desktop: 'Historial mensual' },
    { path: '/compartir', icon: 'share', label: 'Compartir', desktop: 'Resumen WhatsApp' },
    { path: '/configuracion', icon: 'settings', label: 'Ajustes', desktop: 'Configuración' },
  ];
  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const value = params.get('mes');
      const month = value ? `${value}-01` : monthNow();
      this.store.selectedMonth.set(isMonth(month) ? month : monthNow());
    });
    void this.store.load();
    effect(() => {
      if (this.auth.initialized() && !this.auth.user()) void this.router.navigateByUrl('/acceso');
    });
  }
  async changeMonth(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const month = `${input.value}-01`;
    if (!isMonth(month)) {
      input.value = this.store.selectedMonth().slice(0, 7);
      return;
    }
    if (
      this.store.hasUnsavedChanges() &&
      !(await this.confirm.ask({
        title: 'Cambiar de mes',
        message: 'Los cambios sin guardar de este formulario se perderán.',
        action: 'Cambiar de mes',
      }))
    ) {
      input.value = this.store.selectedMonth().slice(0, 7);
      return;
    }
    this.store.hasUnsavedChanges.set(false);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { mes: input.value, recibo: null },
      queryParamsHandling: 'merge',
    });
  }
  async logout(): Promise<void> {
    if (this.store.saving() || this.store.uploading()) return;
    if (
      this.store.hasUnsavedChanges() &&
      !(await this.confirm.ask({
        title: 'Cerrar sesión',
        message: 'Hay cambios sin guardar. ¿Deseas salir?',
        action: 'Cerrar sesión',
      }))
    )
      return;
    this.store.hasUnsavedChanges.set(false);
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/acceso');
    } catch (error) {
      this.snack.open(errorMessage(error), 'Cerrar', { duration: 6000 });
    }
  }
}
