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
page.on("response", (res) => { if (!res.ok() && res.url().includes('/api/')) errors.push("HTTP " + res.status() + " " + res.url()); });

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });
await page.click('text=Conversations');
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "/conversations-open.png" });

console.log("ERRORS:", JSON.stringify(errors));
await browser.close();
