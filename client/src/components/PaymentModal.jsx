import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  Smartphone,
  LoaderCircle,
  CheckCircle,
  Download,
  FileText,
} from 'lucide-react';
import Modal from './Modal';
import { api, money, date } from '../api';
export default function PaymentModal({ initialOrder, onClose, onUpdated, demo }) {
  const [order, setOrder] = useState(initialOrder),
    [phone, setPhone] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const close = useCallback(onClose, [onClose]);
  const expired = order.expires < Date.now();
  useEffect(() => {
    if (!['PENDING', 'REVIEW'].includes(order.status)) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const o = await api('/api/orders/' + order.id);
        if (!stopped) {
          setOrder(o);
          onUpdated?.(o);
        }
      } catch (e) {
        if (!stopped) setError(e.message);
      }
    }, 4000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [order.id, order.status, onUpdated]);
  async function pay(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/api/mpesa/stkpush', {
        method: 'POST',
        body: { orderId: order.id, phone },
      });
      setMessage(result.message);
      setOrder(await api('/api/orders/' + order.id));
    } catch (e) {
      setError(e.message);
      setOrder(await api('/api/orders/' + order.id).catch(() => order));
    } finally {
      setBusy(false);
    }
  }
  async function completeDemo() {
    setBusy(true);
    try {
      const o = await api('/api/demo/complete', { method: 'POST', body: { orderId: order.id } });
      setOrder(o);
      onUpdated?.(o);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function receipt() {
    try {
      const r = await api('/api/receipt/' + order.id);
      const blob = new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'victorious-cyber-receipt.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal
      title={order.status === 'PAID' ? 'Your download is ready' : 'Complete your order'}
      onClose={close}
    >
      <div className="checkout-summary">
        <span className="checkout-icon">
          <FileText size={28} />
        </span>
        <div>
          <h3>{order.title}</h3>
          <p>
            {['cv', 'letter'].includes(order.kind)
              ? `${order.pages} PDF page${order.pages === 1 ? '' : 's'} × ${money(order.unitPrice)}`
              : order.kind === 'cbc'
                ? 'One complete assignment'
                : 'One digital resource'}
          </p>
        </div>
        <strong>{money(order.amount)}</strong>
      </div>
      {demo && <div className="alert">Demo checkout. No real payment will be made.</div>}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {expired ? (
        <div className="alert" role="status">
          This order has expired. Create a new document or contact 0725890432 for help with a
          purchase.
        </div>
      ) : order.status === 'PAID' ? (
        <div className="payment-success">
          <CheckCircle size={46} />
          <h3>{demo ? 'Demo payment completed' : 'Payment confirmed'}</h3>
          <p>
            Receipt: <strong>{order.receipt}</strong>
            <br />
            Download until {date(order.expires)} (EAT).
          </p>
          <div className="download-buttons">
            {order.formats.map((format) => (
              <a
                key={format}
                className="button primary"
                href={`/api/download?orderId=${order.id}&format=${format}`}
              >
                <Download size={17} />
                Download {format === 'file' ? 'file' : format.toUpperCase()}
              </a>
            ))}
          </div>
          <button className="text-button" onClick={receipt}>
            Save payment receipt
          </button>
        </div>
      ) : ['PENDING', 'REVIEW'].includes(order.status) ? (
        <div className="payment-wait">
          <Smartphone size={44} />
          <h3>{order.status === 'REVIEW' ? 'Payment needs verification' : 'Check your phone'}</h3>
          <p>
            {order.status === 'REVIEW'
              ? 'Keep your M-PESA receipt and contact our team. Please do not pay again while we verify the transaction.'
              : message ||
                'Enter your M-PESA PIN on the prompt. We will check payment automatically.'}
          </p>
          {demo && order.status === 'PENDING' && (
            <button className="button primary" onClick={completeDemo} disabled={busy}>
              Simulate successful payment
            </button>
          )}
          {!demo && (
            <span>
              <LoaderCircle size={16} className="spin" /> Checking payment status…
            </span>
          )}
          <small>You may close this window and return through My orders.</small>
        </div>
      ) : (
        <form onSubmit={pay}>
          <div className="mpesa-heading">
            <span>M-PESA</span>
            <ShieldCheck size={20} />
          </div>
          {order.status === 'FAILED' && (
            <div className="alert">The previous payment did not complete. You may try again.</div>
          )}
          <label>
            M-PESA phone number
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0725890432"
              autoComplete="tel"
              required
              pattern="[+0-9 ()-]{10,18}"
            />
          </label>
          <p className="checkout-help">
            You’ll receive a payment prompt on this number. Enter your PIN on your phone only.
          </p>
          <button className="button primary full" disabled={busy}>
            {busy ? <LoaderCircle size={18} className="spin" /> : <Smartphone size={18} />}{' '}
            {busy ? 'Sending prompt…' : `Pay ${money(order.amount)}`}
          </button>
          <p className="checkout-secure">
            <ShieldCheck size={15} /> Your download unlocks after payment verification.
          </p>
        </form>
      )}
    </Modal>
  );
}
