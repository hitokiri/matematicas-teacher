import { chromium } from '@playwright/test';

export default async () => {
  console.log('[Global Setup] Starting...');
  // No global setup needed - Tauri mock is injected via initScript in each test
  console.log('[Global Setup] Done');
};
