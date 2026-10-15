import { ChangeDetectionStrategy, Component, input } from '@angular/core';
const paths: Record<string, string> = {
  home: 'm3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  water: 'M12 3s-7 7.5-7 12a7 7 0 0 0 14 0c0-4.5-7-12-7-12ZM8 15a4 4 0 0 0 4 4',
  bolt: 'm13 2-9 12h7l-1 8 10-13h-8z',
  wifi: 'M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8 16a6 6 0 0 1 8 0M12 20h.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h3',
  calculator: 'M5 3h14v18H5zM8 6h8v4H8zM8 14h1M15 14h1M8 18h1M15 18h1',
  calendar: 'M4 5h16v16H4zM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 18h2',
  settings:
    'm9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM9 10.5l6-4M9 13.5l6 4',
  plus: 'M12 5v14M5 12h14',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  back: 'M20 12H4m6-6-6 6 6 6',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM9 12l2 2 4-4',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  lock: 'M5 10h14v11H5zM8 10V7a4 4 0 0 1 8 0v3M12 14v3',
  key: 'M10 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM10 10h12l-3 3-2-2-2 2-2-3',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M18 18A8 8 0 0 1 5 16',
  info: 'M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0ZM12 11v6M12 7h.01',
  people:
    'M10 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM1 21v-3c0-4 12-4 12 0v3M15 14c4-1 8 1 8 4v3',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  upload: 'M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5',
  copy: 'M8 8h13v13H8zM16 8V3H3v13h5',
  logout: 'M9 3H3v18h6M8 12h13m-5-5 5 5-5 5',
  snow: 'M12 2v20M3 7l18 10M3 17 21 7M9 4l3 3 3-3M9 20l3-3 3 3',
  wallet: 'M3 6h17v15H3zM3 6V3h14v3M15 11h6v5h-6z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  clock: 'M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0ZM12 6v6l4 2',
  edit: 'm15 4 5 5M4 20l5-1L21 7l-5-5L4 14z',
  leaf: 'M20 3c-10-1-18 3-16 12s17 9 16-12ZM4 21 16 9',
  close: 'm6 6 12 12M6 18 18 6',
};
@Component({
  selector: 'app-icon',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles:
    ':host{display:inline-flex;width:24px;height:24px;flex-shrink:0;vertical-align:middle}svg{width:100%;height:100%}',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  name = input('home');
  path = () => paths[this.name()] ?? paths['home'];
}
