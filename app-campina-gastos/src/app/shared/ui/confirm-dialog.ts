import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';
export interface Confirmation {
  title: string;
  message: string;
  action: string;
}
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  template:
    '<h2 mat-dialog-title>{{ data.title }}</h2><mat-dialog-content><p>{{ data.message }}</p></mat-dialog-content><mat-dialog-actions align="end"><button mat-button [mat-dialog-close]="false">Cancelar</button><button mat-flat-button [mat-dialog-close]="true">{{ data.action }}</button></mat-dialog-actions>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  readonly data = inject<Confirmation>(MAT_DIALOG_DATA);
}
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly dialog = inject(MatDialog);
  async ask(data: Confirmation): Promise<boolean> {
    return (
      (await firstValueFrom(
        this.dialog
          .open<ConfirmDialog, Confirmation, boolean>(ConfirmDialog, {
            data,
            width: '440px',
            maxWidth: 'calc(100vw - 32px)',
          })
          .afterClosed(),
      )) === true
    );
  }
}
