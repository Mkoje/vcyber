import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import bcrypt from 'bcryptjs';
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'vcyber-test-'));
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.STORAGE_DIR = temp;
process.env.APP_URL = 'http://localhost:5173';
process.env.GENERATION_LIMIT = '100';
const { initDb, closeDb, query, one } = await import('../server/db.js');
const { createApp } = await import('../server/app.js');
const { normalizePhone, constantEqual } = await import('../server/security.js');
const { validateCallbackMetadata } = await import('../server/mpesa.js');
const { seedResources } = await import('../server/seed.js');
let app, visitor, other, order, resource;
const post = (agent, url, body) => agent.post(url).set('X-VCyber-Request', '1').send(body);
before(async () => {
  await initDb();
  for (const d of ['orders', 'resources', 'quarantine'])
    await fs.mkdir(path.join(temp, d), { recursive: true });
  await seedResources();
  app = createApp();
  visitor = request.agent(app);
  other = request.agent(app);
  await visitor.get('/api/config');
  await other.get('/api/config');
});
after(async () => {
  await closeDb();
  await fs.rm(temp, { recursive: true, force: true });
});
test('Kenyan phones normalize; malformed and foreign numbers fail', () => {
  assert.equal(normalizePhone('0725 890 432'), '254725890432');
  assert.equal(normalizePhone('+254725890432'), '254725890432');
  assert.equal(normalizePhone('0112345678'), '254112345678');
  assert.throws(() => normalizePhone('123'));
  assert.throws(() => normalizePhone('+15551234567'));
  assert.ok(constantEqual('abc', 'abc'));
  assert.equal(constantEqual('', ''), false);
});
test('callback amount, payer and receipt must match the immutable quote', () => {
  const o = { amount: 60, phone: '254725890432' };
  const cb = {
    CallbackMetadata: {
      Item: [
        { Name: 'Amount', Value: 60 },
        { Name: 'PhoneNumber', Value: 254725890432 },
        { Name: 'MpesaReceiptNumber', Value: 'UJ8ABCDE12' },
      ],
    },
  };
  assert.equal(validateCallbackMetadata(o, cb), 'UJ8ABCDE12');
  assert.throws(() => validateCallbackMetadata({ ...o, amount: 30 }, cb));
  assert.throws(() => validateCallbackMetadata({ ...o, phone: '254712345678' }, cb));
});
test('mutations reject missing CSRF verification and foreign origins', async () => {
  assert.equal((await visitor.post('/api/orders').send({})).status, 403);
  assert.equal(
    (await post(visitor, '/api/orders', {}).set('Origin', 'https://evil.example')).status,
    403,
  );
});
test('resource marketplace exposes prices but never private storage paths', async () => {
  const r = await visitor.get('/api/resources');
  assert.equal(r.status, 200);
  resource = r.body.find((x) => x.active);
  assert.ok(resource);
  assert.equal(resource.price, 5);
  assert.equal(
    r.body.some((x) => 'file_path' in x),
    false,
  );
  assert.equal(
    r.body.filter((x) => x.category !== 'documents').every((x) => x.active === 0),
    true,
  );
});
test('generated quote uses rendered PDF pages and clean DOCX is private', async () => {
  const r = await post(visitor, '/api/generate-doc', {
    kind: 'cv',
    template: 'canadian',
    prompt: 'Create a CV for a customer service professional with supplied details.',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  order = r.body;
  assert.equal(order.amount, order.pages * 50);
  assert.ok(order.previewCount >= 1);
  assert.deepEqual(order.formats, ['pdf', 'docx']);
  assert.equal('pdf_path' in order, false);
  const preview = await visitor.get(`/api/preview/${order.id}/1`);
  assert.equal(preview.status, 200);
  assert.equal(preview.headers['content-type'], 'image/jpeg');
  assert.equal((await visitor.get(`/api/preview/${order.id}/999`)).status, 404);
});
test('unpaid downloads are locked, other sessions cannot access previews or orders', async () => {
  assert.equal((await visitor.get(`/api/download?orderId=${order.id}&format=pdf`)).status, 402);
  assert.equal((await other.get(`/api/orders/${order.id}`)).status, 404);
  assert.equal((await other.get(`/api/preview/${order.id}/1`)).status, 404);
  assert.equal((await other.get(`/api/download?orderId=${order.id}&format=docx`)).status, 404);
});
test('checkout ignores client-supplied amount; explicit demo payment unlocks files', async () => {
  let r = await post(visitor, '/api/mpesa/stkpush', {
    orderId: order.id,
    phone: '0725890432',
    amount: 1,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.demo, true);
  r = await post(visitor, '/api/demo/complete', { orderId: order.id });
  assert.equal(r.status, 200);
  assert.equal(r.body.amount, order.amount);
  order = r.body;
  for (const format of ['pdf', 'docx']) {
    r = await visitor.get(`/api/download?orderId=${order.id}&format=${format}`);
    assert.equal(r.status, 200);
    assert.match(r.headers['content-disposition'], /attachment/);
  }
  assert.equal(
    (await post(visitor, '/api/mpesa/stkpush', { orderId: order.id, phone: '0725890432' })).status,
    409,
  );
});
test('recovery requires matching phone AND receipt and cannot recover expired orders', async () => {
  assert.equal(
    (await post(other, '/api/orders/recover', { phone: '0725890432', receipt: 'INVALID0000' }))
      .status,
    404,
  );
  let r = await post(other, '/api/orders/recover', { phone: '0725890432', receipt: order.receipt });
  assert.equal(r.status, 200);
  assert.equal((await other.get(`/api/download?orderId=${order.id}&format=pdf`)).status, 200);
  await query('UPDATE orders SET expires=$1 WHERE id=$2', [Date.now() - 1, order.id]);
  assert.equal((await other.get(`/api/download?orderId=${order.id}&format=pdf`)).status, 410);
  assert.equal(
    (await post(visitor, '/api/orders/recover', { phone: '0725890432', receipt: order.receipt }))
      .status,
    404,
  );
});
test('marketplace checkout cannot override prices or order unavailable software', async () => {
  let r = await post(visitor, '/api/orders', { resourceId: resource.id, amount: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.body.amount, 5);
  const unavailable = (await visitor.get('/api/resources')).body.find((r) => !r.active);
  assert.equal((await post(visitor, '/api/orders', { resourceId: unavailable.id })).status, 404);
});
test('admin endpoints are private; login rotates privilege and prices do not mutate quotes', async () => {
  assert.equal((await visitor.get('/api/admin/stats')).status, 401);
  await query('INSERT INTO admins(email,password_hash) VALUES($1,$2)', [
    'admin@example.com',
    await bcrypt.hash('test-password-only-12345', 10),
  ]);
  const admin = request.agent(app);
  let r = await post(admin, '/api/admin/login', { email: 'admin@example.com', password: 'wrong' });
  assert.equal(r.status, 401);
  r = await post(admin, '/api/admin/login', {
    email: 'admin@example.com',
    password: 'test-password-only-12345',
  });
  assert.equal(r.status, 200);
  assert.match(r.headers['set-cookie'][0], /HttpOnly/);
  r = await admin.get('/api/admin/stats');
  assert.equal(r.status, 200);
  assert.ok(Number(r.body.downloads) >= 3);
  const quote = (await post(visitor, '/api/orders', { resourceId: resource.id })).body;
  r = await admin
    .patch('/api/admin/prices/documents')
    .set('X-VCyber-Request', '1')
    .send({ amount: 8 });
  assert.equal(r.status, 200);
  assert.equal((await one('SELECT amount FROM orders WHERE id=$1', [quote.id])).amount, 5);
  assert.equal((await one('SELECT price FROM resources WHERE id=$1', [resource.id])).price, 8);
  await admin.patch('/api/admin/prices/documents').set('X-VCyber-Request', '1').send({ amount: 5 });
  r = await admin
    .post('/api/admin/resources')
    .set('X-VCyber-Request', '1')
    .field('title', 'Original test guide')
    .field('category', 'documents')
    .field('description', 'An original test guide for integration verification.')
    .field('license', 'Original work, authorised for test distribution.')
    .attach(
      'file',
      Buffer.from('A useful original test document with enough readable text.'),
      'guide.txt',
    );
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal((await post(admin, '/api/admin/logout', {})).status, 200);
  assert.equal((await admin.get('/api/admin/stats')).status, 401);
});
test('untrusted provider callbacks never settle demo orders', async () => {
  const r = await request(app)
    .post('/api/mpesa/callback')
    .send({ Body: { stkCallback: { CheckoutRequestID: 'fake', ResultCode: 0 } } });
  assert.equal(r.status, 403);
});
test('admin listing edits, private files, replacement and unpublishing preserve purchases', async () => {
  const admin = request.agent(app);
  assert.equal((await visitor.get('/api/admin/resources')).status, 401);
  assert.equal(
    (
      await post(admin, '/api/admin/login', {
        email: 'admin@example.com',
        password: 'test-password-only-12345',
      })
    ).status,
    200,
  );
  let resources = (await admin.get('/api/admin/resources')).body;
  const guide = resources.find((r) => r.title === 'Original test guide');
  assert.equal(guide.hasFile, true);
  assert.equal(guide.file_path, undefined);
  const created = await post(visitor, '/api/orders', { resourceId: guide.id });
  const original = (await one('SELECT file_path FROM orders WHERE id=$1', [created.body.id]))
    .file_path;
  assert.equal((await visitor.get('/api/admin/resources/' + guide.id + '/file')).status, 401);
  assert.equal((await admin.get('/api/admin/resources/' + guide.id + '/file')).status, 200);
  let response = await admin
    .post('/api/admin/resources/' + guide.id + '/file')
    .set('X-VCyber-Request', '1')
    .attach('file', Buffer.from('Replacement resource for future purchases.'), 'updated-guide.txt');
  assert.equal(response.status, 200);
  assert.notEqual(
    (await one('SELECT file_path FROM resources WHERE id=$1', [guide.id])).file_path,
    original,
  );
  assert.equal(
    (await one('SELECT file_path FROM orders WHERE id=$1', [created.body.id])).file_path,
    original,
  );
  assert.match(await fs.readFile(original, 'utf8'), /useful original/);
  response = await admin
    .patch('/api/admin/resources/' + guide.id)
    .set('X-VCyber-Request', '1')
    .send({
      title: 'Updated original guide',
      description: 'Updated description for the new original guide.',
      license: 'Original work authorised for distribution.',
      active: 0,
    });
  assert.equal(response.status, 200);
  assert.equal(
    (await visitor.get('/api/resources')).body.some((r) => r.id === guide.id),
    false,
  );
  assert.equal((await post(visitor, '/api/orders', { resourceId: guide.id })).status, 404);
  assert.equal(
    (await admin.get('/api/admin/resources')).body.find((r) => r.id === guide.id).title,
    'Updated original guide',
  );
  response = await admin
    .patch('/api/admin/resources/' + guide.id)
    .set('X-VCyber-Request', '1')
    .send({ active: 1 });
  assert.equal(response.status, 200);
  assert.equal(
    (await visitor.get('/api/resources')).body.some((r) => r.id === guide.id),
    true,
  );
  response = await admin
    .patch('/api/admin/resources/' + 'a'.repeat(48))
    .set('X-VCyber-Request', '1')
    .send({ active: 0 });
  assert.equal(response.status, 404);
  response = await admin
    .post('/api/admin/resources/' + guide.id + '/file')
    .set('X-VCyber-Request', '1')
    .attach('file', Buffer.from('invalid'), 'script.html');
  assert.equal(response.status, 415);
});
test('CBC diagram generation uses a fixed assignment price regardless of pages', async () => {
  const r = await post(visitor, '/api/generate-doc', {
    kind: 'cbc',
    grade: 'Grade 4',
    subject: 'Science & Technology',
    illustration: 'diagram',
    prompt: 'Make an activity sheet about how plants grow and need sunlight.',
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.amount, 10);
  assert.ok(r.body.pages >= 1);
});
test('uploaded DOCX extracts readable text and rejects decompression bombs', async () => {
  const { extractCv } = await import('../server/uploads.js');
  const { default: AdmZip } = await import('adm-zip');
  const zip = new AdmZip();
  zip.addFile(
    'word/document.xml',
    Buffer.from(
      '<w:document xmlns:w="x"><w:body><w:p><w:r><w:t>Jane Wanjiku &amp; customer support</w:t></w:r></w:p></w:body></w:document>',
    ),
  );
  const p = path.join(temp, 'quarantine', 'sample.docx');
  await fs.writeFile(p, zip.toBuffer());
  const text = await extractCv({ path: p, size: 2000, originalname: 'sample.docx' });
  assert.match(text, /Jane Wanjiku & customer support/);
  await assert.rejects(fs.access(p));
  const huge = new AdmZip();
  huge.addFile('word/document.xml', Buffer.alloc(17 * 1024 * 1024, 65));
  const bigPath = path.join(temp, 'quarantine', 'huge.docx');
  await fs.writeFile(bigPath, huge.toBuffer());
  await assert.rejects(
    extractCv({ path: bigPath, size: 100000, originalname: 'huge.docx' }),
    /expanded CV is too large/,
  );
});
test('real Daraja flow requires query verification and matching metadata; duplicate callbacks are safe', async () => {
  const { config } = await import('../server/config.js');
  const { stkPush, settleAttempt } = await import('../server/mpesa.js');
  const originalFetch = globalThis.fetch,
    oldMpesa = { ...config.mpesa };
  config.demo = false;
  Object.assign(config.mpesa, {
    consumerKey: 'test',
    consumerSecret: 'test',
    passkey: 'test',
    paybill: '174379',
    callbackSecret: 'test-callback-secret-32-characters',
    callbackUrl: 'https://vcyber.co.ke/api/mpesa/callback',
  });
  let verifiedCode = 0,
    pushBody;
  globalThis.fetch = async (url, options = {}) => {
    if (url.includes('/oauth/'))
      return Response.json({ access_token: 'mock-provider-token', expires_in: '3600' });
    if (url.includes('/processrequest')) {
      pushBody = JSON.parse(options.body);
      return Response.json({
        ResponseCode: '0',
        CheckoutRequestID: 'ws_CO_test_001',
        MerchantRequestID: 'mock-merchant-001',
      });
    }
    if (url.includes('/query'))
      return Response.json({ ResponseCode: '0', ResultCode: verifiedCode });
    throw Error('Unexpected provider endpoint');
  };
  try {
    const created = await post(visitor, '/api/orders', { resourceId: resource.id });
    let o = await one('SELECT * FROM orders WHERE id=$1', [created.body.id]);
    await stkPush(o, '0725890432');
    assert.equal(pushBody.Amount, 5);
    assert.match(pushBody.CallBackURL, /secret=/);
    await assert.rejects(stkPush(o, '0725890432'), /already pending/);
    const a = await one('SELECT * FROM attempts WHERE order_id=$1', [o.id]);
    o = await one('SELECT * FROM orders WHERE id=$1', [o.id]);
    const callback = {
      CheckoutRequestID: a.checkout_id,
      MerchantRequestID: a.merchant_id,
      ResultCode: 0,
      CallbackMetadata: {
        Item: [
          { Name: 'Amount', Value: 5 },
          { Name: 'PhoneNumber', Value: 254725890432 },
          { Name: 'MpesaReceiptNumber', Value: 'UJ8RECEIPT1' },
        ],
      },
    };
    verifiedCode = 1032;
    await assert.rejects(settleAttempt(a, callback), /results do not match/);
    assert.equal((await one('SELECT status FROM orders WHERE id=$1', [o.id])).status, 'PENDING');
    verifiedCode = 0;
    const wrong = {
      ...callback,
      CallbackMetadata: {
        Item: callback.CallbackMetadata.Item.map((x) =>
          x.Name === 'Amount' ? { ...x, Value: 1 } : x,
        ),
      },
    };
    await assert.rejects(settleAttempt(a, wrong), /did not match/);
    await settleAttempt(a, callback);
    await settleAttempt(a, callback);
    assert.equal((await one('SELECT status FROM orders WHERE id=$1', [o.id])).status, 'PAID');
  } finally {
    globalThis.fetch = originalFetch;
    config.demo = true;
    Object.assign(config.mpesa, oldMpesa);
  }
});
