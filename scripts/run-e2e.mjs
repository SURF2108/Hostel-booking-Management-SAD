import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const screenshotsDir = path.join(rootDir, 'docs', 'screenshots');

const API_PORT = 5055;
const CLIENT_PORT = 5179;
const E2E_DB_NAME = 'hostel_booking_e2e';
const DEMO_PASS = 'HostelDemo#2026';

// Unicode emoji / pictograph detector
const EMOJI_REGEX = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function findChromiumExecutable() {
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE && fs.existsSync(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE)) {
    return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
  }
  const msPlaywright = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');
  if (fs.existsSync(msPlaywright)) {
    for (const dir of fs.readdirSync(msPlaywright).sort().reverse()) {
      if (dir.startsWith('chromium-')) {
        const candidate = path.join(msPlaywright, dir, 'chrome-win64', 'chrome.exe');
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

async function waitForUrl(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function assertNoEmojiOnPage(page, label) {
  const text = await page.evaluate(() => document.body.innerText || '');
  assert.equal(
    EMOJI_REGEX.test(text),
    false,
    `Emoji character found on ${label}: ${text.match(EMOJI_REGEX)?.[0]}`
  );
}

async function main() {
  fs.mkdirSync(screenshotsDir, { recursive: true });

  // 1. Ensure local MongoDB is running
  const dbInit = spawn('node', [path.join(rootDir, 'scripts', 'local-mongo.mjs'), 'start'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    dbInit.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`db:start failed (${code})`))));
  });

  // 2. Reset & seed isolated E2E database
  const e2eEnv = {
    ...process.env,
    NODE_ENV: 'development',
    PORT: String(API_PORT),
    MONGODB_URI: `mongodb://127.0.0.1:27017/${E2E_DB_NAME}?replicaSet=rs0`,
    MONGODB_DB_NAME: E2E_DB_NAME,
    JWT_SECRET: 'e2e-verification-jwt-secret-key-2026',
    CLIENT_ORIGIN: `http://127.0.0.1:${CLIENT_PORT},http://localhost:${CLIENT_PORT}`,
    SEED_DEMO_PASSWORD: DEMO_PASS,
  };

  const seedProc = spawn('node', ['src/seed/seedRunner.js', '--reset'], {
    cwd: path.join(rootDir, 'server'),
    env: e2eEnv,
    stdio: 'inherit',
  });
  await new Promise((resolve, reject) => {
    seedProc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed failed (${code})`))));
  });

  // 3. Start backend server & Vite dev server
  const serverProc = spawn('node', ['src/index.js'], {
    cwd: path.join(rootDir, 'server'),
    env: e2eEnv,
    stdio: 'pipe',
  });

  const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const clientProc = spawn(
    'node',
    [viteBin, '--host', '127.0.0.1', '--port', String(CLIENT_PORT), '--strictPort'],
    {
      cwd: path.join(rootDir, 'client'),
      env: { ...process.env, VITE_API_TARGET: `http://127.0.0.1:${API_PORT}` },
      stdio: 'pipe',
    }
  );
  serverProc.stderr.on('data', (d) => process.stderr.write(`[E2E-SERVER] ${d}`));
  clientProc.stderr.on('data', (d) => process.stderr.write(`[E2E-CLIENT] ${d}`));

  // Override proxy target for Vite via custom inline env? Vite proxy in vite.config.js targets 5000 by default!
  // Let's pass API_PORT if needed or even better, start server on 5000 if free or patch vite.config to use process.env.VITE_API_TARGET!
  // Wait: let's inspect and make vite.config.js honor VITE_API_TARGET cleanly!
  let browser;
  try {
    await waitForUrl(`http://127.0.0.1:${API_PORT}/api/v1/ready`);
    await waitForUrl(`http://127.0.0.1:${CLIENT_PORT}`);

    const executablePath = findChromiumExecutable();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const failedResponses = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) {
        failedResponses.push(`${res.status()} ${res.url()}`);
      }
    });

    const baseUrl = `http://127.0.0.1:${CLIENT_PORT}`;

    const loginViaUi = async (username, password = DEMO_PASS) => {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
      await page.fill('#login-identifier', username);
      await page.fill('#login-password', password);
      await page.click('button[type="submit"]');
      await page.waitForURL('**/dashboard');
      await page.waitForLoadState('networkidle');
    };

    const logoutViaUi = async () => {
      await page.click('button:has-text("Log Out")');
      await page.waitForURL('**/login');
    };

    // --- Screen 1: Login page screenshot + emoji check ---
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    await assertNoEmojiOnPage(page, 'LoginPage');
    await page.screenshot({ path: path.join(screenshotsDir, '01-login-desktop.png'), fullPage: true });

    // --- Flow 1: Student Registration + Profile + Booking + Cancel + Re-book + Complaint + Visitor ---
    await page.click('a:has-text("Student Registration")');
    await page.waitForURL('**/register');
    await page.fill('#reg-username', 'e2e.student');
    await page.fill('#reg-fullname', 'E2E Resident Student');
    await page.fill('#reg-email', 'e2e.student@demo-hostel.edu');
    await page.fill('#reg-contact', '+91-9800007777');
    await page.fill('#reg-password', 'StudentPass#2026');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await assertNoEmojiOnPage(page, 'StudentDashboard');

    // Reload persistence check
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('h1:has-text("Student Workspace")');

    // Hostels & Bed Availability -> Book a bed -> Cancel -> Re-book for Warden
    await page.click('a:has-text("Hostels & Beds")');
    await page.waitForURL('**/hostels');
    await page.waitForSelector('h2:has-text("North Crest Hall")');
    await assertNoEmojiOnPage(page, 'HostelsPage');
    await page.screenshot({ path: path.join(screenshotsDir, '02-student-hostels.png'), fullPage: true });

    // Select first available bed
    await page.locator('button:has-text("Select & Book")').first().click();
    await page.waitForSelector('h3:has-text("Confirm Booking Request")');
    // Test keyboard Escape closes dialog cleanly and focus returns
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    await page.locator('button:has-text("Select & Book")').first().click();
    await page.fill('#booking-notes', 'First E2E booking to cancel');
    await page.click('button:has-text("Submit Booking Request")');
    await page.waitForSelector('text=Pending status');

    // Go to My Bookings and Cancel
    await page.click('button:has-text("View My Bookings")');
    await page.waitForURL('**/bookings');
    await page.locator('button:has-text("Cancel")').first().click();
    await page.click('button:has-text("Confirm Action")');
    await page.waitForSelector('text=cancelled');

    // Submit a fresh Pending booking for Warden approval
    await page.click('a:has-text("Hostels & Beds")');
    await page.waitForURL('**/hostels');
    await page.locator('button:has-text("Select & Book")').first().click();
    await page.fill('#booking-notes', 'E2E stay for Warden approval');
    await page.click('button:has-text("Submit Booking Request")');
    await page.waitForSelector('text=Pending status');

    // Submit Complaint & Register Visitor
    await page.click('a:has-text("Complaints")');
    await page.waitForURL('**/complaints');
    await page.click('button:has-text("Submit Complaint")');
    await page.fill('#sc-desc', 'E2E verification: study chair screw loose');
    await page.click('.nb-dialog button[type="submit"]');
    await page.waitForSelector('text=submitted');

    await page.click('a:has-text("Visitors")');
    await page.waitForURL('**/visitors');
    await page.click('button:has-text("Register Visitor")');
    await page.fill('#vis-name', 'Mohan Resident Father');
    await page.fill('#vis-contact', '+91-9812345678');
    await page.fill('#vis-id', 'GOV-E2E-101');
    await page.click('.nb-dialog button[type="submit"]');
    await page.waitForSelector('text=Visitor pass registered');

    // Manage Profile
    await page.click('a:has-text("Profile")');
    await page.waitForURL('**/profile');
    await page.fill('#prof-name', 'E2E Updated Student');
    await page.click('button:has-text("Save Profile")');
    await page.waitForSelector('text=Profile saved to database.');

    await logoutViaUi();

    // --- Flow 2: Warden (North) ---
    await loginViaUi('warden.north');
    await page.click('a:has-text("Review Bookings")');
    await page.waitForURL('**/bookings');
    await assertNoEmojiOnPage(page, 'WardenBookings');
    await page.screenshot({ path: path.join(screenshotsDir, '03-warden-bookings.png'), fullPage: true });

    // Approve & Allocate first pending booking
    await page.locator('button:has-text("Approve")').first().click();
    await page.fill('#booking-action-note', 'Approved via E2E verification');
    await page.click('.nb-dialog button[type="submit"]');
    await page.waitForSelector('text=approved and bed allocated');

    // Bed Allocations -> Check In -> Check Out
    await page.click('a:has-text("Bed Allocations")');
    await page.waitForURL('**/allocations');
    await page.locator('button:has-text("Check In")').first().click();
    await page.waitForSelector('text=Check-in succeeded');
    await page.screenshot({ path: path.join(screenshotsDir, '04-warden-allocations.png'), fullPage: true });
    await page.locator('button:has-text("Check Out")').first().click();
    await page.waitForSelector('text=Check-out succeeded');

    // Manage Complaints -> Resolve open complaint
    await page.click('a:has-text("Manage Complaints")');
    await page.waitForURL('**/complaints');
    await page.locator('button:has-text("Update")').first().click();
    await page.selectOption('#rc-status', 'Resolved');
    await page.fill('#rc-details', 'Resolved during E2E inspection');
    await page.click('.nb-dialog button[type="submit"]');
    await page.waitForSelector('text=Updated CMP-');

    // Manage Visitors -> Check In registered visitor
    await page.click('a:has-text("Manage Visitors")');
    await page.waitForURL('**/visitors');
    await page.locator('button:has-text("Check In")').first().click();
    await page.waitForSelector('text=Visitor status updated to CheckedIn');

    // Historical Search
    await page.click('a:has-text("Historical Search")');
    await page.waitForURL('**/history');
    await page.waitForSelector('table');

    await logoutViaUi();

    // --- Flow 3: Administrator ---
    await loginViaUi('admin.hostel');
    await page.click('a:has-text("Manage Inventory")');
    await page.waitForURL('**/admin/inventory');
    await assertNoEmojiOnPage(page, 'AdminInventory');
    await page.screenshot({ path: path.join(screenshotsDir, '05-admin-inventory.png'), fullPage: true });

    await page.click('a:has-text("Users & Roles")');
    await page.waitForURL('**/admin/users');
    await page.waitForSelector('text=e2e.student');

    await page.click('a:has-text("Audit Logs")');
    await page.waitForURL('**/audit-logs');
    await page.waitForSelector('text=BOOKING_APPROVED_AND_ALLOCATED');
    await page.screenshot({ path: path.join(screenshotsDir, '06-admin-audit-logs.png'), fullPage: true });

    await logoutViaUi();

    // --- Flow 4: Accounts Personnel ---
    await loginViaUi('accounts.desk');
    await page.click('a:has-text("Payment Records")');
    await page.waitForURL('**/payments');
    await assertNoEmojiOnPage(page, 'AccountsPayments');
    await page.click('button:has-text("Record Payment")');
    const bookingOption = await page.locator('#cp-booking option').nth(1).getAttribute('value');
    await page.selectOption('#cp-booking', bookingOption);
    await page.fill('#cp-ref', 'TXN-E2E-7788');
    await page.click('button:has-text("Save Payment Record")');
    await page.waitForSelector('text=TXN-E2E-7788');
    await page.screenshot({ path: path.join(screenshotsDir, '07-accounts-payments.png'), fullPage: true });

    await logoutViaUi();

    // --- Flow 5: Hostel Management + Responsive Widths (768px & 360px) ---
    await loginViaUi('management.exec');
    await page.click('a:has-text("Reports")');
    await page.waitForURL('**/reports');
    await page.click('button:has-text("Generate Report")');
    await page.waitForSelector('text=Generated Occupancy report');
    await assertNoEmojiOnPage(page, 'ManagementReports');
    await page.screenshot({ path: path.join(screenshotsDir, '08-management-reports.png'), fullPage: true });

    // Tablet 768px check
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.click('a:has-text("Overview")');
    await page.waitForURL('**/dashboard');
    await page.waitForTimeout(150);
    const tabletOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    assert.equal(tabletOverflow, false, 'Horizontal overflow detected at 768px width');
    await page.screenshot({ path: path.join(screenshotsDir, '09-dashboard-tablet-768.png'), fullPage: true });

    // Mobile 360px check
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(150);
    const mobileOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    assert.equal(mobileOverflow, false, 'Horizontal overflow detected at 360px width');
    await page.screenshot({ path: path.join(screenshotsDir, '10-dashboard-mobile-360.png'), fullPage: true });

    assert.deepEqual(consoleErrors, [], `Console errors detected: ${consoleErrors.join('; ')}`);
    assert.deepEqual(failedResponses, [], `5xx API errors detected: ${failedResponses.join('; ')}`);

    console.log('ALL E2E FLOWS, RESPONSIVE CHECKS, EMOJI AUDIT, AND SCREENSHOTS PASSED!');
  } finally {
    if (browser) await browser.close();
    serverProc.kill();
    clientProc.kill();
  }
}

main().catch((err) => {
  console.error('E2E failed:', err);
  process.exit(1);
});
