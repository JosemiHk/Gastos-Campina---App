import { inject, Injectable } from '@angular/core';
import { Supabase } from '../core/supabase';
export interface UploadedFile {
  filePath: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}
@Injectable({ providedIn: 'root' })
export class Files {
  private readonly backend = inject(Supabase);
  validate(file: File): void {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.type))
      throw new Error('El archivo debe ser JPG, PNG o PDF.');
    if (file.size <= 0 || file.size > 10 * 1024 * 1024)
      throw new Error('El archivo debe pesar como máximo 10 MB.');
  }
  async upload(file: File, household: string, month: string): Promise<UploadedFile> {
    this.validate(file);
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' }[
      file.type
    ];
    const filePath = `${household}/${month.slice(0, 7)}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.backend.client.storage
      .from('receipts')
      .upload(filePath, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return {
      filePath,
      fileName: file.name.slice(0, 255),
      fileType: file.type,
      fileSize: file.size,
    };
  }
  async removeUnused(path: string): Promise<void> {
    await this.backend.client.storage.from('receipts').remove([path]);
  }
  async signedUrl(path: string): Promise<string> {
    const { data, error } = await this.backend.client.storage
      .from('receipts')
      .createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  }
}
