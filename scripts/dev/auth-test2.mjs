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
page.on("requestfailed", (req) => errors.push("REQFAIL " + req.url()));

await page.goto("http://localhost:3000", { waitUntil: "networkidle", timeout: 30000 });

// Send a chat message via the chat form specifically (not the topbar search)
await page.fill('form input[placeholder="Ask anything"]', "I want to get better at public speaking");
await page.click('form button[aria-label="Send"]');
await page.waitForSelector('text=Save as Journey', { timeout: 30000 });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "/chat-reply.png" });

// Click Save as Journey
await page.click('text=Save as Journey');
await page.waitForSelector('text=Your Journeys', { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "/journeys-after-save.png" });

// Check sidebar reflects it too by going Home
await page.click('nav >> text=Home');
await page.waitForTimeout(500);
await page.screenshot({ path: OUT + "/home-after-save.png" });

console.log("ERRORS:", JSON.stringify(errors));
await browser.close();
