import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { formatMoney } from '../../domain/money';
@Component({
  selector: 'app-payment-dialog',
  imports: [MatDialogModule, MatButtonModule, ReactiveFormsModule],
  template: ` <h2 mat-dialog-title>
      {{ data.void ? 'Anular confirmación' : 'Confirmar aporte recibido' }}
    </h2>
    <mat-dialog-content
      ><p>{{ data.name }}</p>
      <strong class="money amount">{{ money(data.amount) }}</strong>
      @if (data.void) {
        <p>El registro se conservará con el motivo de anulación.</p>
        <div class="field">
          <label for="void-reason">Motivo</label
          ><textarea id="void-reason" [formControl]="reason" rows="3" maxlength="300"></textarea
          ><small>Entre 3 y 300 caracteres.</small>
        </div>
      } @else {
        <p>
          Confirma solo cuando hayas recibido este dinero. Esta acción registra el aporte en
          Campiña.
        </p>
        <div class="field">
          <label for="payment-method">¿Cómo recibiste el aporte?</label
          ><select id="payment-method" [formControl]="method">
            @for (option of methods; track option) {
              <option [value]="option">{{ option }}</option>
            }
          </select>
        </div>
      }</mat-dialog-content
    ><mat-dialog-actions align="end"
      ><button mat-button [mat-dialog-close]="null">Cancelar</button
      ><button
        mat-flat-button
        [disabled]="data.void && reason.invalid"
        [mat-dialog-close]="data.void ? reason.value.trim() : method.value"
      >
        {{ data.void ? 'Anular confirmación' : 'Confirmar recibido' }}
      </button></mat-dialog-actions
    >`,
  styles:
    '.amount{display:block;font-size:28px;color:var(--primary);margin:12px 0 24px}textarea{resize:vertical}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDialog {
  readonly data = inject<{ void: boolean; name: string; amount: number }>(MAT_DIALOG_DATA);
  readonly money = formatMoney;
  readonly methods = ['Yape', 'Plin', 'Transferencia', 'Efectivo', 'Otro'];
  readonly method = new FormControl('Yape', { nonNullable: true });
  readonly reason = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      (control) => (String(control.value).trim().length < 3 ? { short: true } : null),
      Validators.maxLength(300),
    ],
  });
}
