import { defineConfig } from '@playwright/test';
import base from './playwright.all.config';

if (!process.env.PLAYWRIGHT_BASE_URL?.startsWith('https://')) {
  throw new Error('PLAYWRIGHT_BASE_URL muss die HTTPS-Adresse des zu prüfenden Netlify-Deploys enthalten.');
}

export default defineConfig(base, {
  testMatch: '**/hosting.e2e.spec.ts',
  testIgnore: [],
  webServer: undefined,
});
