import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { RuntimeConfig } from './core/config';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => inject(RuntimeConfig).load()),
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes)
  ]
};
