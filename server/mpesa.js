import { config } from './config.js';
import { HttpError, id, normalizePhone } from './security.js';
import { one, query } from './db.js';
const base = () =>
  config.mpesa.env === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
let cachedToken;
async function token() {
  if (cachedToken && cachedToken.until > Date.now()) return cachedToken.value;
  const { consumerKey, consumerSecret } = config.mpesa;
  if (!consumerKey || !consumerSecret)
    throw new HttpError(503, 'M-PESA checkout is being configured. Please contact us.');
  const r = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: 'Basic ' + Buffer.from(consumerKey + ':' + consumerSecret).toString('base64'),
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new HttpError(502, 'Unable to connect to M-PESA. Please try again.');
  const data = await r.json();
  if (!data.access_token) throw new HttpError(502, 'M-PESA authentication failed.');
  cachedToken = {
    value: data.access_token,
    until: Date.now() + Math.max(30, Number(data.expires_in || 3600) - 60) * 1000,
  };
  return cachedToken.value;
}
function password() {
  const Timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  return {
    Timestamp,
    Password: Buffer.from(config.mpesa.paybill + config.mpesa.passkey + Timestamp).toString(
      'base64',
    ),
  };
}
async function call(endpoint, body) {
  const r = await fetch(base() + endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw new HttpError(
      502,
      'M-PESA is temporarily unavailable. Check your order before retrying.',
    );
  return r.json();
}
export async function stkPush(order, phone) {
  const normalized = normalizePhone(phone);
  if (order.status === 'PAID') throw new HttpError(409, 'This order is already paid.');
  if (order.expires < Date.now())
    throw new HttpError(410, 'This draft has expired. Please create a new one.');
  if (config.demo) {
    await query(
      "UPDATE orders SET status='PENDING',phone=$1 WHERE id=$2 AND status IN ('UNPAID','FAILED')",
      [normalized, order.id],
    );
    return { demo: true, message: 'Demo checkout — no money is charged.' };
  }
  if (
    !config.mpesa.paybill ||
    !config.mpesa.passkey ||
    !config.mpesa.callbackSecret ||
    !config.mpesa.callbackUrl
  )
    throw new HttpError(503, 'M-PESA checkout is being configured.');
  // An atomic state change prevents simultaneous duplicate STK requests.
  const claimed = await query(
    "UPDATE orders SET status='PENDING',phone=$1 WHERE id=$2 AND status IN ('UNPAID','FAILED') RETURNING id",
    [normalized, order.id],
  );
  if (!claimed.length)
    throw new HttpError(409, 'A payment is already pending. Check its status before retrying.');
  const attemptId = id();
  await query('INSERT INTO attempts(id,order_id,state,created_at) VALUES($1,$2,$3,$4)', [
    attemptId,
    order.id,
    'STARTING',
    Date.now(),
  ]);
  const url = new URL(config.mpesa.callbackUrl);
  url.searchParams.set('secret', config.mpesa.callbackSecret);
  try {
    const result = await call('/mpesa/stkpush/v1/processrequest', {
      BusinessShortCode: config.mpesa.paybill,
      ...password(),
      TransactionType: config.mpesa.transactionType,
      Amount: order.amount,
      PartyA: normalized,
      PartyB: config.mpesa.paybill,
      PhoneNumber: normalized,
      CallBackURL: url.toString(),
      AccountReference: 'VC' + order.id.slice(0, 8),
      TransactionDesc: 'Victorious Cyber',
    });
    if (String(result.ResponseCode) !== '0' || !result.CheckoutRequestID) {
      await query("UPDATE attempts SET state='FAILED' WHERE id=$1", [attemptId]);
      await query("UPDATE orders SET status='FAILED' WHERE id=$1 AND status='PENDING'", [order.id]);
      throw new HttpError(502, 'M-PESA did not accept the payment request. Please try again.');
    }
    await query("UPDATE attempts SET checkout_id=$1,merchant_id=$2,state='PENDING' WHERE id=$3", [
      result.CheckoutRequestID,
      result.MerchantRequestID,
      attemptId,
    ]);
    return { demo: false, message: 'Check your phone and enter your M-PESA PIN.' };
  } catch (e) {
    // Timeouts are ambiguous. Never permit a second debit until staff reconcile it.
    const a = await one('SELECT state FROM attempts WHERE id=$1', [attemptId]);
    if (a?.state === 'STARTING') {
      await query("UPDATE attempts SET state='REVIEW' WHERE id=$1", [attemptId]);
      await query("UPDATE orders SET status='REVIEW' WHERE id=$1 AND status='PENDING'", [order.id]);
    }
    throw e;
  }
}
export async function queryStk(checkoutId) {
  return call('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: config.mpesa.paybill,
    ...password(),
    CheckoutRequestID: checkoutId,
  });
}
export function validateCallbackMetadata(order, callback) {
  const values = Object.fromEntries(
    (callback.CallbackMetadata?.Item || []).map((x) => [x.Name, x.Value]),
  );
  if (
    Number(values.Amount) !== Number(order.amount) ||
    normalizePhone(values.PhoneNumber) !== order.phone ||
    !/^([A-Z0-9]{8,20})$/.test(String(values.MpesaReceiptNumber || ''))
  )
    throw new HttpError(400, 'Payment metadata did not match the order.');
  return values.MpesaReceiptNumber;
}
export async function settleAttempt(attempt, callback) {
  const order = await one('SELECT * FROM orders WHERE id=$1', [attempt.order_id]);
  if (order.status === 'PAID') return;
  if (
    callback.CheckoutRequestID !== attempt.checkout_id ||
    callback.MerchantRequestID !== attempt.merchant_id
  )
    throw new HttpError(400, 'M-PESA request IDs do not match.');
  // STK callbacks have no cryptographic signature; verify independently with Daraja.
  const verified = await queryStk(attempt.checkout_id);
  if (!Object.hasOwn(verified, 'ResultCode')) return;
  const code = Number(verified.ResultCode);
  if (code !== 0) {
    const latest = await one(
      'SELECT id FROM attempts WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1',
      [order.id],
    );
    if (latest?.id !== attempt.id) return;
    if (Number(callback.ResultCode) !== code)
      throw new HttpError(400, 'M-PESA results do not match.');
    await query("UPDATE attempts SET state='FAILED',result_code=$1 WHERE id=$2 AND state!='PAID'", [
      code,
      attempt.id,
    ]);
    await query("UPDATE orders SET status='FAILED' WHERE id=$1 AND status!='PAID'", [order.id]);
    return;
  }
  if (Number(callback.ResultCode) !== 0) throw new HttpError(400, 'M-PESA results do not match.');
  const receipt = validateCallbackMetadata(order, callback),
    now = Date.now();
  await query(
    "UPDATE orders SET status='PAID',receipt=$1,paid_at=$2,expires=$3 WHERE id=$4 AND status!='PAID'",
    [receipt, now, now + 86400000, order.id],
  );
  await query("UPDATE attempts SET state='PAID',result_code=0 WHERE id=$1", [attempt.id]);
}
export async function reconcile() {
  if (config.demo) return;
  const attempts = await query(
    "SELECT * FROM attempts WHERE state IN ('PENDING','REVIEW') AND created_at<$1 AND checkout_id IS NOT NULL ORDER BY created_at LIMIT 20",
    [Date.now() - 15000],
  );
  for (const a of attempts) {
    try {
      if (a.callback_json) await settleAttempt(a, JSON.parse(a.callback_json));
      else {
        const result = await queryStk(a.checkout_id);
        if (Object.hasOwn(result, 'ResultCode')) {
          if (Number(result.ResultCode) !== 0) {
            const latest = await one(
              'SELECT id FROM attempts WHERE order_id=$1 ORDER BY created_at DESC LIMIT 1',
              [a.order_id],
            );
            if (latest?.id !== a.id) continue;
            await query(
              "UPDATE attempts SET state='FAILED',result_code=$1 WHERE id=$2 AND state!='PAID'",
              [Number(result.ResultCode), a.id],
            );
            await query("UPDATE orders SET status='FAILED' WHERE id=$1 AND status!='PAID'", [
              a.order_id,
            ]);
          } else {
            await query("UPDATE attempts SET state='REVIEW' WHERE id=$1", [a.id]);
            await query("UPDATE orders SET status='REVIEW' WHERE id=$1 AND status!='PAID'", [
              a.order_id,
            ]);
          }
        }
      }
    } catch {
      console.warn('M-PESA reconciliation deferred for attempt', a.id.slice(0, 8));
    }
  }
}
