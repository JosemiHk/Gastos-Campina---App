import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Files } from '../../data-access/files';
import { Receipt } from '../../domain/models';
import { errorMessage } from '../../core/errors';
@Component({
  selector: 'app-file-preview',
  imports: [MatDialogModule, MatButtonModule],
  template:
    '<h2 mat-dialog-title>{{ data.name }}</h2><mat-dialog-content>@if(data.type.startsWith("image/")){<img [src]="data.url" [alt]="data.name">}@else{<p>El comprobante PDF se abrirá en una nueva pestaña.</p>}<p>Este enlace de acceso privado vence en cinco minutos.</p></mat-dialog-content><mat-dialog-actions><a mat-flat-button [href]="data.url" target="_blank" rel="noopener noreferrer">Abrir comprobante</a><button mat-button mat-dialog-close>Cerrar</button></mat-dialog-actions>',
  styles:
    'img{display:block;max-width:100%;max-height:65vh;margin:auto}p{margin-top:16px;font-size:12px}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreview {
  readonly data = inject<{ url: string; name: string; type: string }>(MAT_DIALOG_DATA);
}
@Injectable({ providedIn: 'root' })
export class ReceiptPreview {
  private readonly files = inject(Files);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  async open(receipt: Pick<Receipt, 'filePath' | 'fileType' | 'fileName'>): Promise<void> {
    if (!receipt.filePath) return;
    try {
      const url = await this.files.signedUrl(receipt.filePath);
      this.dialog.open(FilePreview, {
        data: { url, name: receipt.fileName ?? 'Comprobante', type: receipt.fileType ?? '' },
        width: '800px',
        maxWidth: 'calc(100vw - 24px)',
      });
    } catch (error) {
      this.snack.open(errorMessage(error), 'Cerrar', { duration: 6000 });
    }
  }
}
