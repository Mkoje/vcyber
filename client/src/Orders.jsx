import { useEffect, useState } from 'react';
import { FileText, Search, LoaderCircle } from 'lucide-react';
import { api, money, date } from './api';
export default function Orders({ onOrder, revision }) {
  const [orders, setOrders] = useState([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [phone, setPhone] = useState(''),
    [receipt, setReceipt] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api('/api/orders')
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [revision]);
  async function recover(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const o = await api('/api/orders/recover', { method: 'POST', body: { phone, receipt } });
      setOrders((previous) => [o, ...previous.filter((x) => x.id !== o.id)]);
      onOrder(o);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page section">
      <span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span>
      <h1>Your orders & downloads</h1>
      <p>Return to your purchases, complete a pending payment or retrieve a receipt.</p>
      <div className="orders-grid">
        <section>
          <h2>Recent orders</h2>
          {loading ? (
            <LoaderCircle className="spin" />
          ) : orders.length ? (
            orders.map((o) => (
              <article className="order-row" key={o.id}>
                <FileText size={25} />
                <div>
                  <h3>{o.title}</h3>
                  <small>
                    {o.pages} page{o.pages > 1 ? 's' : ''} ·{' '}
                    <span className={'status ' + o.status.toLowerCase()}>{o.status}</span>
                  </small>
                </div>
                <strong>{money(o.amount)}</strong>
                <button className="button secondary small" onClick={() => onOrder(o)}>
                  {o.status === 'PAID' ? 'Download' : 'View order'}
                </button>
              </article>
            ))
          ) : (
            <div className="empty">
              <FileText size={32} />
              <h3>No orders on this device yet</h3>
              <p>Create a document or recover a recent purchase.</p>
              <a className="button primary" href="/#studio">
                Open document studio
              </a>
            </div>
          )}
        </section>
        <form className="card recovery" onSubmit={recover}>
          <Search size={28} />
          <h2>Find a past purchase</h2>
          <p>
            Enter the paying phone number and receipt code from your M-PESA message. Downloads are
            available for 24 hours after payment.
          </p>
          <label>
            Phone number
            <input
              type="tel"
              placeholder="0725890432"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <label>
            M-PESA receipt code
            <input
              value={receipt}
              onChange={(e) => setReceipt(e.target.value.toUpperCase())}
              placeholder="e.g. UJ8ABCDE12"
              minLength={8}
              maxLength={24}
              required
            />
          </label>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <button className="button primary" disabled={busy}>
            {busy ? 'Searching…' : 'Retrieve purchase'}
          </button>
        </form>
      </div>
    </main>
  );
}
