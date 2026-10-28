import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig(base, {
  projects: [{ name: 'edge', use: { browserName: 'chromium', channel: 'msedge' } }],
});
