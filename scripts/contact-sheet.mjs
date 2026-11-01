// Dev tool: put several screenshots into one image (a grid), to review quickly.
//   node scripts/contact-sheet.mjs out.png a.png b.png ...
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [outFile, ...files] = process.argv.slice(2);
const cells = files
  .map(
    (f) =>
      `<figure><img src="${pathToFileURL(resolve(f)).href}"><figcaption>${f.split(/[\\/]/).pop()}</figcaption></figure>`,
  )
  .join('');
const html = `<body style="margin:0;background:#222;color:#fff;font:11px monospace;display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${cells}<style>figure{margin:0}img{width:100%;display:block}</style></body>`;
const tmp = resolve('test-results/_sheet.html');
writeFileSync(tmp, html);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 400 } });
await page.goto(pathToFileURL(tmp).href);
await page.waitForTimeout(200);
await page.screenshot({ path: outFile, fullPage: true });
await browser.close();
