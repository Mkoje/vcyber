// Requires a running emulator. Uses the isolated demo server from browser-runner.mjs.
import { chromium } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const exec = promisify(execFile);
const adbPath = path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
const serial = process.env.ANDROID_SERIAL || 'emulator-5554';
if (!serial.startsWith('emulator-')) throw new Error('Acceptance testing requires an emulator.');
const adb = (...args) => exec(adbPath, ['-s', serial, ...args], { timeout: 60000 });
const output = process.env.QA_DIR || path.join(os.tmpdir(), 'vcyber-browser');
await fs.mkdir(output, { recursive: true });
let dumpId = 0;
async function ui() {
  for (let i = 0; i < 5; i++) {
    const file = '/sdcard/vcyber-ui-' + ++dumpId + '.xml';
    await adb('shell', 'uiautomator', 'dump', file);
    try {
      return (await adb('shell', 'cat', file)).stdout;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error('Android accessibility hierarchy unavailable.');
}
async function tapNode(attribute, value) {
  const xml = await ui();
  const node = [...xml.matchAll(/<node\b[^>]+>/g)]
    .map((match) => match[0])
    .find((node) => node.includes(`${attribute}="${value}"`));
  if (!node) throw new Error('Native control not found: ' + value);
  const bounds = node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  await adb(
    'shell',
    'input',
    'tap',
    String(Math.floor((+bounds[1] + +bounds[3]) / 2)),
    String(Math.floor((+bounds[2] + +bounds[4]) / 2)),
  );
  await new Promise((resolve) => setTimeout(resolve, 750));
}
await adb('reverse', 'tcp:3002', 'tcp:3002');
await adb('install', '-r', 'android-admin/app/build/outputs/apk/debug/app-debug.apk');
await adb('shell', 'am', 'force-stop', 'ke.co.vcyber.admin.debug');
await adb('shell', 'am', 'start', '-n', 'ke.co.vcyber.admin.debug/ke.co.vcyber.admin.MainActivity');
await new Promise((resolve) => setTimeout(resolve, 1000));
await tapNode('text', 'SERVER');
await tapNode('class', 'android.widget.EditText');
await adb('shell', 'input', 'keyevent', '123');
await adb('shell', 'input', 'keyevent', ...Array(80).fill('67'));
await adb('shell', 'input', 'text', process.env.BASE_URL);
await tapNode('text', 'CONNECT');
const pid = (await adb('shell', 'pidof', 'ke.co.vcyber.admin.debug')).stdout.trim();
await adb('forward', 'tcp:9223', 'localabstract:webview_devtools_remote_' + pid);
let browser;
for (let i = 0; i < 30 && !browser; i++) {
  try {
    browser = await chromium.connectOverCDP('http://127.0.0.1:9223');
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
if (!browser) throw new Error('Android WebView debugging connection unavailable.');
try {
  const page = browser.contexts()[0].pages()[0];
  await page.getByRole('heading', { name: 'Admin sign in' }).waitFor();
  await page.getByLabel('Email', { exact: true }).fill(process.env.TEST_ADMIN_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('heading', { name: 'Your digital counter' }).waitFor();
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Android dashboard overflows',
  );
  const fixture = path.join(output, 'android-acceptance.txt');
  await fs.writeFile(fixture, 'Original document uploaded through the Android system file picker.');
  await adb('push', fixture, '/sdcard/Download/android-acceptance.txt');
  await page.getByLabel('Title', { exact: true }).fill('Android uploaded document');
  await page
    .getByLabel('Description', { exact: true })
    .fill('Original document uploaded using the Android application.');
  await page
    .getByLabel('Distribution rights / license', { exact: true })
    .fill('Original work authorised for test distribution.');
  await page.getByLabel('Resource file', { exact: true }).click();
  await tapNode('content-desc', 'Show roots');
  await tapNode('text', 'Downloads');
  await tapNode('text', 'android-acceptance.txt');
  await page.waitForFunction(() => document.querySelector('input[name=file]').files.length === 1);
  await page.getByRole('button', { name: 'Upload & publish' }).click();
  await page.getByText('Resource uploaded and published.', { exact: true }).waitFor();
  await page.getByText('Android uploaded document', { exact: true }).waitFor();
  await page.screenshot({ path: path.join(output, 'android-admin.png'), fullPage: true });
  const listing = page.locator('.resource-management').first();
  await listing.getByRole('button', { name: 'Unpublish', exact: true }).click();
  await listing.getByRole('button', { name: 'Publish', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('heading', { name: 'Admin sign in', exact: true }).waitFor();
  console.log(
    'Android acceptance passed: launch, server selection, login, native file picker upload, dashboard layout, unpublish and logout.',
  );
} finally {
  await browser.close();
  await adb('forward', '--remove', 'tcp:9223');
  await adb('reverse', '--remove', 'tcp:3002');
}
