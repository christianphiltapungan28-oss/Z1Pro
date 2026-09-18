import { chromium } from "playwright";

const TOKEN = process.env.SESSION_TOKEN;
const OUT = process.env.OUT_DIR;

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([{
  name: "authjs.session-token",
  value: TOKEN,
  domain: "localhost",
  path: "/",
  httpOnly: true,
  sameSite: "Lax",
}]);
const page = await context.newPage();
const errors = [];
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + "/auth-home.png" });

const signedIn = await page.locator('text=Claude').first().isVisible().catch(() => false);
console.log("Signed in as Claude visible:", signedIn);

// Search bar type test
await page.fill('input[placeholder="Ask anything"]', "hello world");
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + "/auth-search-typed.png" });

console.log("ERRORS:", JSON.stringify(errors));
await browser.close();
