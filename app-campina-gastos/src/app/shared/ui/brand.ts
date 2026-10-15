import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Icon } from './icon';
@Component({
  selector: 'app-brand',
  imports: [Icon],
  template:
    '<span class="mark"><app-icon name="home" /></span><span><strong>Campiña Gastos</strong><small>Cuentas claras en casa</small></span>',
  styles:
    ':host{display:flex;align-items:center;gap:12px;color:var(--primary)}.mark{display:grid;place-items:center;width:44px;height:44px;background:var(--primary);color:white;border-radius:14px}strong{font-size:20px;letter-spacing:-.6px}small{display:block;font-size:11px;color:var(--text-secondary);margin-top:3px}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Brand {}
