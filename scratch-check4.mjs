import { chromium } from "playwright";

const shotDir = "C:/Users/yagod/AppData/Local/Temp/claude/c--Users-yagod-Desktop-product-explorer-next/0fd8a751-72db-477a-87c1-6b553da55184/scratchpad";

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 850 } });
const page = await context.newPage();

const errors = [];
page.on("console", (msg) => { if (msg.type() === "error" || msg.type() === "warning") errors.push(`${msg.type()}: ${msg.text()}`); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000/giris", { waitUntil: "load", timeout: 30000 });
await page.click("text=Misafir olarak göz at");
await page.waitForURL("**/akis", { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1000);

await page.goto("http://localhost:3000/kesfet", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForSelector("text=Kategori", { timeout: 20000 });
await page.waitForTimeout(500);

const btn = page.getByRole("button", { name: /Keşfet kategorileri/i });
const count = await btn.count();
console.log("button matched by aria-label count:", count);
if (count > 0) {
  const cls = await btn.first().getAttribute("class");
  console.log("button class:", cls);
  await btn.first().click();
  await page.waitForTimeout(400);
  const expanded = await btn.first().getAttribute("aria-expanded");
  console.log("aria-expanded after click:", expanded);
  const menu = page.locator('[role="menu"]');
  console.log("menu count:", await menu.count());
  if (await menu.count() > 0) {
    const box = await menu.first().boundingBox();
    console.log("menu bounding box:", JSON.stringify(box));
  }
}

await page.screenshot({ path: `${shotDir}/check4.png` });
console.log("console:", JSON.stringify(errors, null, 2));
await browser.close();
