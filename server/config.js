import 'dotenv/config';
import path from 'node:path';
export const config = {
  production: process.env.NODE_ENV === 'production',
  demo: process.env.DEMO_MODE === 'true',
  port: Number(process.env.PORT || 3001),
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  storage: path.resolve(process.env.STORAGE_DIR || './storage'),
  popplerBin: process.env.POPPLER_BIN || '',
  databaseUrl: process.env.DATABASE_URL,
  mpesa: {
    env: process.env.MPESA_ENV || 'sandbox',
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    passkey: process.env.MPESA_PASSKEY,
    paybill: process.env.MPESA_PAYBILL,
    transactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    callbackSecret: process.env.MPESA_CALLBACK_SECRET,
  },
};
export function validateConfig() {
  if (config.production) {
    if (config.demo) throw new Error('DEMO_MODE must be false in production.');
    if (!config.databaseUrl) throw new Error('Production requires DATABASE_URL.');
    if (!config.appUrl.startsWith('https://'))
      throw new Error('Production requires HTTPS APP_URL.');
    if (!process.env.OPENAI_API_KEY) throw new Error('Production requires OPENAI_API_KEY.');
    for (const key of [
      'consumerKey',
      'consumerSecret',
      'passkey',
      'paybill',
      'callbackUrl',
      'callbackSecret',
    ])
      if (!config.mpesa[key]) throw new Error(`Missing M-PESA configuration: ${key}`);
    if (config.mpesa.callbackSecret.length < 32)
      throw new Error('Use a callback secret of at least 32 characters.');
    if (!config.mpesa.callbackUrl.startsWith('https://'))
      throw new Error('M-PESA callback requires HTTPS.');
  }
  if (!['sandbox', 'live'].includes(config.mpesa.env))
    throw new Error('MPESA_ENV must be sandbox or live.');
  if (!['CustomerPayBillOnline', 'CustomerBuyGoodsOnline'].includes(config.mpesa.transactionType))
    throw new Error('Unsupported M-PESA transaction type.');
}
