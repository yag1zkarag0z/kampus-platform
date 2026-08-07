import { chromium } from "playwright";

const shotDir = "C:/Users/yagod/AppData/Local/Temp/claude/c--Users-yagod-Desktop-product-explorer-next/0fd8a751-72db-477a-87c1-6b553da55184/scratchpad";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 850 } });
const page = await context.newPage();

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000/giris", { waitUntil: "load", timeout: 30000 });
await page.click("text=Misafir olarak göz at");
await page.waitForURL("**/akis", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1000);

await page.goto("http://localhost:3000/kesfet", { waitUntil: "load", timeout: 30000 });
await page.waitForSelector("text=Kategori", { timeout: 20000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${shotDir}/check3-row.png` });

await page.click("text=Kategori");
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/check3-dropdown.png` });

// also check desktop width
await page.setViewportSize({ width: 800, height: 900 });
await page.waitForTimeout(300);
await page.screenshot({ path: `${shotDir}/check3-dropdown-wide.png` });

console.log("errors:", JSON.stringify(errors));
await browser.close();
