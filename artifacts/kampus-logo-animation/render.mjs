import { chromium } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1080, height: 1080 },
  recordVideo: { dir: here, size: { width: 1080, height: 1080 } },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(pathToFileURL(path.join(here, 'index.html')).href);
await page.waitForTimeout(250);
await page.evaluate(() => window.startAnimation());
await page.waitForTimeout(3400);
await page.screenshot({ path: path.join(here, 'preview.png') });
await page.waitForTimeout(1200);
const video = page.video();
await page.close();
const temporaryPath = await video.path();
await context.close();
await browser.close();

const fs = await import('node:fs/promises');
const outputPath = path.join(here, 'kampus-logo-animation.webm');
await fs.rm(outputPath, { force: true });
await fs.rename(temporaryPath, outputPath);
console.log(outputPath);
