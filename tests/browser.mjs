// Start demo app first: DEMO_MODE=true APP_URL=http://127.0.0.1:3002 PORT=3002 npm start
// Then: BASE_URL=http://127.0.0.1:3002 npm run test:browser
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import AdmZip from 'adm-zip';
const base = process.env.BASE_URL || 'http://127.0.0.1:3002';
const output = process.env.QA_DIR || '/tmp/vcyber-browser';
await fs.mkdir(output, { recursive: true });
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(base + '/api/health')).ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 100));
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    colorScheme: 'light',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByText('Business quotation template', { exact: true }).waitFor();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.hero-workspace')).opacity) > 0.99,
  );
  await page.screenshot({ path: output + '/desktop.png', fullPage: true });
  await page.getByRole('tab', { name: /CV & resume/ }).click();
  await page.getByLabel('Choose your template').selectOption('canadian');
  await page
    .getByLabel('Your details & instructions')
    .fill(
      'Jane Wanjiku. Customer service specialist in Nairobi with three years of experience. Diploma in business management. Reformat into a Canadian style resume.',
    );
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: 'Generate & preview' }).click();
  await page.getByRole('dialog').waitFor();
  await page.locator('.preview-area img').first().waitFor();
  await page.screenshot({ path: output + '/preview.png' });
  await page.getByRole('button', { name: /Continue ·/ }).click();
  await page.getByLabel('M-PESA phone number').fill('0725890432');
  await page.getByRole('button', { name: /Pay KSh/ }).click();
  await page.getByRole('button', { name: 'Simulate successful payment' }).click();
  await page.getByRole('heading', { name: 'Demo payment completed' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Download PDF', exact: true }).count(), 1);
  const pdfUrl = await page
    .getByRole('link', { name: 'Download PDF', exact: true })
    .getAttribute('href');
  const docxUrl = await page
    .getByRole('link', { name: 'Download DOCX', exact: true })
    .getAttribute('href');
  const pdfDownload = await page.request.get(base + pdfUrl);
  const docxDownload = await page.request.get(base + docxUrl);
  assert.equal(pdfDownload.status(), 200);
  assert.equal(docxDownload.status(), 200);
  const pdfBytes = await pdfDownload.body(),
    docxBytes = await docxDownload.body();
  assert.equal(pdfBytes.subarray(0, 5).toString(), '%PDF-');
  assert.equal(docxBytes.subarray(0, 2).toString(), 'PK');
  const headers = { 'X-VCyber-Request': '1' };
  for (const template of ['modern', 'executive', 'academic', 'compressed']) {
    const response = await page.request.post(base + '/api/generate-doc', {
      headers,
      data: {
        kind: 'cv',
        template,
        prompt:
          'Jane Wanjiku. Customer support specialist with a diploma and three years of experience.',
      },
    });
    assert.equal(response.status(), 201);
    const order = await response.json();
    assert.ok(order.pages >= 1);
    assert.equal((await page.request.get(base + `/api/preview/${order.id}/1`)).status(), 200);
    assert.equal(
      (await page.request.get(base + `/api/download?orderId=${order.id}&format=pdf`)).status(),
      402,
    );
  }
  for (const kind of ['letter', 'cbc']) {
    const response = await page.request.post(base + '/api/generate-doc', {
      headers,
      data: {
        kind,
        illustration: kind === 'cbc' ? 'diagram' : 'none',
        prompt: 'Create a useful educational document about a growing plant for a Grade 4 learner.',
      },
    });
    assert.equal(response.status(), 201);
    const order = await response.json();
    assert.equal((await page.request.get(base + `/api/preview/${order.id}/1`)).status(), 200);
  }
  for (const [name, mimeType, buffer] of [
    ['existing.pdf', 'application/pdf', pdfBytes],
    [
      'existing.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      docxBytes,
    ],
  ]) {
    const response = await page.request.post(base + '/api/generate-doc', {
      headers,
      multipart: {
        kind: 'cv',
        prompt: 'Reformat this existing CV using only the supplied information.',
        cv: { name, mimeType, buffer },
      },
    });
    assert.equal(response.status(), 201, await response.text());
  }
  await page.screenshot({ path: output + '/payment.png' });
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByLabel('Search resources').fill('quotation');
  assert.equal(await page.locator('.resource-card').count(), 1);
  await page.getByLabel('Search resources').fill('nothing-like-this-resource');
  await page.getByRole('heading', { name: 'No matching resources' }).waitFor();
  await page.getByLabel('Search resources').fill('');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
  await page.screenshot({ path: output + '/dark.png', fullPage: true });
  await page.getByRole('link', { name: 'My orders', exact: true }).click();
  await page.getByRole('button', { name: 'Download', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Victorious Cyber home' }).first().click();
  await page.getByRole('tab', { name: /Letters & applications/ }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(
    await page.getByRole('tab', { name: /CV & resume/ }).getAttribute('aria-selected'),
    'true',
  );
  await page.goto(base + '/privacy');
  await page.getByRole('heading', { name: 'Privacy policy', exact: true }).waitFor();
  await page.goto(base + '/terms');
  await page.getByRole('heading', { name: 'Terms of service', exact: true }).waitFor();
  await page.goto(base + '/missing-page');
  await page.getByRole('heading', { name: 'Page not found', exact: true }).waitFor();
  await page.goto(base);
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByText('Business quotation template', { exact: true }).waitFor();
  await page.waitForFunction(
    () => Number(getComputedStyle(document.querySelector('.hero-workspace')).opacity) > 0.99,
  );
  await page.screenshot({ path: output + '/mobile.png', fullPage: true });
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    'Mobile page overflows horizontally',
  );
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'My orders', exact: true }).click();
  await page.getByRole('heading', { name: 'Your orders & downloads' }).waitFor();
  await page.goto(base + '/admin');
  await page.getByRole('heading', { name: 'Admin sign in' }).waitFor();
  if (process.env.TEST_ADMIN_EMAIL) {
    await page.getByLabel('Email', { exact: true }).fill(process.env.TEST_ADMIN_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(process.env.TEST_ADMIN_PASSWORD);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByRole('heading', { name: 'Your digital counter' }).waitFor();
    await page.getByLabel('Title', { exact: true }).fill('Browser test resource');
    await page.locator('select[name=category]').selectOption('documents');
    await page
      .getByLabel('Description', { exact: true })
      .fill('An original resource uploaded during the browser acceptance check.');
    await page
      .getByLabel('Distribution rights / license')
      .fill('Original content. Authorised for personal use and distribution.');
    await page.getByLabel('Resource file').setInputFiles({
      name: 'browser-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('A complete original test resource created for acceptance checking.'),
    });
    await page.getByRole('button', { name: 'Upload & publish' }).click();
    await page.getByText('Resource uploaded and published.').waitFor();
    const listing = page.locator('.resource-management').first();
    await listing.locator('summary').click();
    await listing.getByLabel('Listing title').fill('Updated browser resource');
    await listing.getByRole('button', { name: 'Save listing', exact: true }).click();
    await listing.getByText('Listing saved.', { exact: true }).waitFor();
    await listing.getByLabel('Replacement file').setInputFiles({
      name: 'replacement.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Replacement file for future customers.'),
    });
    await listing.getByRole('button', { name: 'Replace file', exact: true }).click();
    await listing
      .getByText('File replaced. Existing purchases keep their original file.')
      .waitFor();
    await listing.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await listing.getByRole('button', { name: 'Publish', exact: true }).waitFor();
    await listing.getByRole('button', { name: 'Publish', exact: true }).click();
    await listing.getByRole('button', { name: 'Unpublish', exact: true }).waitFor();
    // A software package uses the same authenticated upload workflow.
    await page.getByLabel('Title', { exact: true }).fill('Original software package');
    await page.locator('select[name=category]').selectOption('software');
    await page
      .getByLabel('Description', { exact: true })
      .fill('Original software archive for browser acceptance testing.');
    await page
      .getByLabel('Distribution rights / license', { exact: true })
      .fill('Original work authorised for test distribution.');
    const software = new AdmZip();
    software.addFile('README.txt', Buffer.from('Original test package; no executable content.'));
    await page.getByLabel('Resource file', { exact: true }).setInputFiles({
      name: 'software.zip',
      mimeType: 'application/zip',
      buffer: software.toBuffer(),
    });
    await page.getByRole('button', { name: 'Upload & publish' }).click();
    await page.getByText('Resource uploaded and published.').waitFor();
    await page.getByText('Original software package', { exact: true }).waitFor();
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Mobile admin page overflows horizontally',
    );
    await page.screenshot({ path: output + '/admin.png', fullPage: true });
    assert.equal(
      (
        await page.request.patch(base + '/api/admin/prices/cv', { headers, data: { amount: 42 } })
      ).status(),
      200,
    );
    assert.equal(
      (
        await page.request.patch(base + '/api/admin/prices/premiumCv', {
          headers,
          data: { amount: 68 },
        })
      ).status(),
      200,
    );
    await page.goto(base);
    await page.getByText('From KSh 42 / page', { exact: true }).first().waitFor();
    await page.getByRole('tab', { name: /CV & resume/ }).click();
    await page
      .getByRole('option', { name: 'Canadian — KSh 68/page', exact: true })
      .waitFor({ state: 'attached' });
    await page.goto(base + '/terms');
    await page.getByText(/Standard CVs cost KSh 42 per PDF page/).waitFor();
    await page.goto(base + '/admin');
    await page.getByRole('heading', { name: 'Your digital counter', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.getByRole('heading', { name: 'Admin sign in', exact: true }).waitFor();
  }

  assert.deepEqual(errors, []);
  console.log(
    'Browser checks passed: generation, preview, checkout, search, dark mode, mobile navigation, order history and admin sign-in.',
  );
  await context.close();
} catch (e) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: output + '/failure.png', fullPage: true }).catch(() => {});
    console.error('Page alerts:', await page.locator('.alert').allTextContents());
    console.error('Resource listings:', await page.locator('.availability-row').allTextContents());
  }
  throw e;
} finally {
  await browser.close();
}
