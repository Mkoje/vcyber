import { useEffect, useState } from 'react';
import { Wallet, Download, Receipt, Upload, LogOut, LoaderCircle } from 'lucide-react';
import { api, money, date } from './api';
import ResourceEditor from './components/ResourceEditor';
export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false),
    [checking, setChecking] = useState(true),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [stats, setStats] = useState(null),
    [resources, setResources] = useState([]),
    [prices, setPrices] = useState([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false);
  async function refresh() {
    const [s, r, c] = await Promise.all([
      api('/api/admin/stats'),
      api('/api/admin/resources'),
      api('/api/config'),
    ]);
    setStats(s);
    setResources(r);
    setPrices(c.prices);
  }
  useEffect(() => {
    api('/api/admin/session')
      .then((s) => {
        setAuthenticated(s.authenticated);
        if (s.authenticated) return refresh();
      })
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, []);
  async function login(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/admin/login', { method: 'POST', body: { email, password } });
      setPassword('');
      setAuthenticated(true);
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    const form = e.currentTarget;
    try {
      const body = new FormData(form);
      if (body.get('file').size > 100 * 1024 * 1024)
        throw new Error('Maximum file size is 100 MB.');
      await api('/api/admin/resources', { method: 'POST', body });
      form.reset();
      setNotice('Resource uploaded and published.');
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function toggle(r) {
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/resources/' + r.id, {
        method: 'PATCH',
        body: { active: r.active ? 0 : 1 },
      });
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function price(e, p) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/prices/' + p.id, {
        method: 'PATCH',
        body: { amount: Number(new FormData(e.currentTarget).get('amount')) },
      });
      setNotice('Price tier updated. Existing order quotes are unchanged.');
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (checking)
    return (
      <main className="section page">
        <LoaderCircle className="spin" />
      </main>
    );
  if (!authenticated)
    return (
      <main className="section page">
        <form className="card login-card" onSubmit={login}>
          <span className="eyebrow">VICTORIOUS CYBER</span>
          <h1>Admin sign in</h1>
          <p>Manage resources, payments and pricing.</p>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <div className="alert error">{error}</div>}
          <button className="button primary full" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </main>
    );
  return (
    <main className="section page admin">
      <div className="section-heading">
        <div>
          <span className="eyebrow">BUSINESS OVERVIEW</span>
          <h1>Your digital counter</h1>
          <p>Payments and downloads. All in one place.</p>
        </div>
        <button
          className="button secondary"
          onClick={async () => {
            try {
              await api('/api/admin/logout', { method: 'POST' });
              setAuthenticated(false);
              setStats(null);
              setResources([]);
              setNotice('');
            } catch (e) {
              setError(e.message);
            }
          }}
        >
          <LogOut size={17} />
          Sign out
        </button>
      </div>
      {stats?.demo && (
        <div className="alert">
          Demo statistics include simulated payments. They are not real revenue.
        </div>
      )}
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="alert success" role="status">
          {notice}
        </div>
      )}
      <div className="stat-grid">
        {[
          { icon: Wallet, label: 'Total revenue', value: money(stats?.totals.revenue || 0) },
          { icon: Receipt, label: 'Today’s payments (EAT)', value: stats?.daily.payments || 0 },
          { icon: Wallet, label: 'Today’s revenue', value: money(stats?.daily.revenue || 0) },
          { icon: Download, label: 'Downloads', value: stats?.downloads || 0 },
        ].map((s) => (
          <div className="card stat" key={s.label}>
            <s.icon size={23} />
            <small>{s.label}</small>
            <strong>{s.value}</strong>
          </div>
        ))}
      </div>
      <div className="admin-grid">
        <form className="card" onSubmit={upload}>
          <Upload size={26} />
          <h2>Add a resource</h2>
          <label>
            Title
            <input name="title" minLength={4} maxLength={120} required />
          </label>
          <label>
            Category
            <select name="category">
              {['documents', 'software', 'resetters'].map((category) => (
                <option key={category} value={category}>
                  {
                    {
                      documents: 'Documents',
                      software: 'Software',
                      resetters: 'Printer utilities',
                    }[category]
                  }{' '}
                  — {money(prices.find((p) => p.id === category)?.amount || 0)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea name="description" minLength={10} maxLength={1000} rows={3} required />
          </label>
          <label>
            Distribution rights / license
            <textarea
              name="license"
              minLength={10}
              maxLength={1000}
              rows={2}
              placeholder="Specify the license and confirm you may distribute this file."
              required
            />
          </label>
          <label>
            Resource file
            <input type="file" name="file" required />
          </label>
          <p className="fineprint">
            Maximum 100 MB. Production uploads require a successful ClamAV scan. Publish only files
            you are authorised to distribute.
          </p>
          <button className="button primary" disabled={busy}>
            {busy ? 'Uploading…' : 'Upload & publish'}
          </button>
        </form>
        <div>
          <section className="card">
            <h2>Price tiers</h2>
            {prices.map((p) => (
              <form className="price-row" key={p.id} onSubmit={(e) => price(e, p)}>
                <label htmlFor={'price-' + p.id}>{p.label}</label>
                <input
                  id={'price-' + p.id}
                  type="number"
                  name="amount"
                  min="1"
                  max="10000"
                  defaultValue={p.amount}
                  required
                />
                <button className="button secondary small" disabled={busy}>
                  Save
                </button>
              </form>
            ))}
          </section>
          <section className="card">
            <h2>Manage resources</h2>
            <p>Edit listings, replace files and control publication.</p>
            {resources.map((r) => (
              <div className="resource-management" key={r.id}>
                <div className="availability-row">
                  <span>
                    <strong>{r.title}</strong>
                    <small>
                      {money(r.price)} · {r.category} · {r.active ? 'Published' : 'Unpublished'}
                    </small>
                    <small>
                      {r.original_name || 'Upload a file to make this listing available'}
                    </small>
                  </span>
                  <button
                    className="text-button"
                    disabled={busy || (!r.active && !r.hasFile)}
                    onClick={() => toggle(r)}
                  >
                    {r.active ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
                <ResourceEditor resource={r} onSaved={refresh} />
              </div>
            ))}
          </section>
        </div>
      </div>
      <section className="card">
        <h2>Recent transactions</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Receipt</th>
                <th>Date (EAT)</th>
              </tr>
            </thead>
            <tbody>
              {stats?.orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    {o.title}
                    <small>{o.id.slice(0, 12)}</small>
                  </td>
                  <td>
                    <span className={'status ' + o.status.toLowerCase()}>{o.status}</span>
                  </td>
                  <td>{money(o.amount)}</td>
                  <td>{o.receipt || '—'}</td>
                  <td>{date(o.paid_at || o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {!!stats?.pending.length && (
        <section className="card">
          <h2>Payments needing attention</h2>
          <p>
            Verify ambiguous payments before a customer retries. Missing callbacks require the
            documented merchant-statement recovery process.
          </p>
          {stats.pending.map((a) => (
            <div className="availability-row" key={a.id}>
              <span>
                {a.title} · {money(a.amount)}
                <small>
                  {a.state} · {a.checkout_id || 'No checkout ID returned'}
                </small>
              </span>
              <button
                className="button secondary small"
                onClick={async () => {
                  try {
                    await api('/api/admin/reconcile', {
                      method: 'POST',
                      body: { attemptId: a.id },
                    });
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  }
                }}
              >
                Verify again
              </button>
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
