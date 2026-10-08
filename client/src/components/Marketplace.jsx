import { useMemo, useState } from 'react';
import { Search, FileText, Monitor, Printer, Download, LoaderCircle } from 'lucide-react';
import { api, money } from '../api';
const icons = { documents: FileText, software: Monitor, resetters: Printer };
export default function Marketplace({ resources, onOrder }) {
  const [search, setSearch] = useState(''),
    [category, setCategory] = useState('all'),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
  const filtered = useMemo(
    () =>
      resources.filter(
        (r) =>
          (category === 'all' || r.category === category) &&
          `${r.title} ${r.description}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [resources, search, category],
  );
  async function buy(r) {
    setBusy(r.id);
    setError('');
    try {
      onOrder(await api('/api/orders', { method: 'POST', body: { resourceId: r.id } }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  }
  return (
    <section id="marketplace" className="section marketplace">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE RESOURCE SHELF</span>
          <h2>Useful files. Just a few clicks away.</h2>
          <p>Templates, software and printer tools for your everyday work.</p>
        </div>
        <span className="section-number">02 / DISCOVER</span>
      </div>
      <div className="market-toolbar">
        <div className="filters" aria-label="Resource category">
          {[
            ['all', 'All resources'],
            ['documents', 'Documents'],
            ['software', 'Software'],
            ['resetters', 'Printer utilities'],
          ].map(([value, label]) => (
            <button
              key={value}
              className={category === value ? 'active' : ''}
              aria-pressed={category === value}
              onClick={() => setCategory(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search">
          <Search size={19} />
          <input
            aria-label="Search resources"
            placeholder="Find a resource…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      <div className="resource-grid">
        {filtered.map((r) => {
          const Icon = icons[r.category];
          return (
            <article className="resource-card" key={r.id}>
              <div className={`resource-cover ${r.category}`}>
                <Icon size={40} strokeWidth={1.4} />
                <span>
                  {r.category === 'documents'
                    ? 'DOCUMENT'
                    : r.category === 'software'
                      ? 'SOFTWARE'
                      : 'PRINTER TOOL'}
                </span>
                <span className="cover-watermark">VC</span>
              </div>
              <div className="resource-info">
                <span className="overline">
                  {r.category === 'documents' ? 'READY TO DOWNLOAD' : 'DIGITAL TOOL'}
                </span>
                <h3>{r.title}</h3>
                <p>{r.description}</p>
                <details className="resource-license">
                  <summary>File & usage license</summary>
                  <p>{r.original_name || 'File pending upload'}</p>
                  <p>{r.license}</p>
                </details>
                <div className="resource-bottom">
                  <strong>
                    {money(r.price)}
                    <small> / file</small>
                  </strong>
                  <button
                    className="button small secondary"
                    onClick={() => buy(r)}
                    disabled={!r.active || busy === r.id}
                  >
                    {busy === r.id ? (
                      <LoaderCircle size={15} className="spin" />
                    ) : r.active ? (
                      <Download size={15} />
                    ) : null}
                    {r.active ? 'Get file' : 'Coming soon'}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <div className="empty">
          <Search size={30} />
          <h3>No matching resources</h3>
          <p>Try another word or choose a different category.</p>
        </div>
      )}
      <div className="resource-footnote">
        Need a specific form or printer utility?{' '}
        <a href="https://wa.me/254725890432" target="_blank" rel="noreferrer">
          Ask our team on WhatsApp.
        </a>
      </div>
    </section>
  );
}
