import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import Header from './components/Header';
import Hero from './components/Hero';
import AIGenerator from './components/AIGenerator';
import Marketplace from './components/Marketplace';
import Footer from './components/Footer';
import PreviewModal from './components/PreviewModal';
import PaymentModal from './components/PaymentModal';
import Orders from './Orders';
import Admin from './Admin';
import Legal from './Legal';
import { api } from './api';
import './styles.css';
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="section page">
        <h1>We couldn’t load this page.</h1>
        <p>Reload or call 0725890432 for help.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
function App() {
  const [theme, setTheme] = useState(
      () =>
        localStorage.getItem('vc-theme') ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
    ),
    [kind, setKind] = useState('letter'),
    [configuration, setConfiguration] = useState(null),
    [resources, setResources] = useState([]),
    [preview, setPreview] = useState(null),
    [payment, setPayment] = useState(null),
    [orderRevision, setOrderRevision] = useState(0),
    [loadError, setLoadError] = useState('');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('vc-theme', theme);
  }, [theme]);
  useEffect(() => {
    Promise.all([api('/api/config'), api('/api/resources')])
      .then(([c, r]) => {
        setConfiguration(c);
        setResources(r);
      })
      .catch((e) => setLoadError(e.message));
  }, []);
  const closePreview = useCallback(() => setPreview(null), []),
    closePayment = useCallback(() => setPayment(null), []),
    updatePayment = useCallback(() => setOrderRevision((revision) => revision + 1), []);
  const path = location.pathname.replace(/\/$/, '') || '/';
  return (
    <ErrorBoundary>
      <MotionConfig reducedMotion="user">
        <Header theme={theme} setTheme={setTheme} />
        {configuration?.demo && (
          <div className="demo-banner">
            LOCAL DEMO · Sample documents and simulated payments. No money is charged.
          </div>
        )}
        {loadError && (
          <div className="section alert error" role="alert">
            Unable to reach the service: {loadError}.{' '}
            <button className="text-button" onClick={() => location.reload()}>
              Try again
            </button>
          </div>
        )}
        {path === '/admin' ? (
          <Admin />
        ) : path === '/orders' ? (
          <Orders onOrder={setPayment} revision={orderRevision} />
        ) : ['/terms', '/privacy'].includes(path) ? (
          <Legal privacy={path === '/privacy'} prices={configuration?.prices} />
        ) : path === '/' ? (
          <main>
            <Hero onSelect={setKind} prices={configuration?.prices} />
            <AIGenerator
              kind={kind}
              setKind={setKind}
              configuration={configuration}
              onGenerated={setPreview}
            />
            <Marketplace resources={resources} onOrder={setPayment} />
          </main>
        ) : (
          <main className="section page">
            <h1>Page not found</h1>
            <a href="/" className="button primary">
              Go home
            </a>
          </main>
        )}
        <Footer />
        {preview && (
          <PreviewModal
            order={preview}
            onClose={closePreview}
            onCheckout={(o) => {
              setPreview(null);
              setPayment(o);
            }}
          />
        )}
        {payment && (
          <PaymentModal
            initialOrder={payment}
            onClose={closePayment}
            onUpdated={updatePayment}
            demo={configuration?.demo}
          />
        )}
      </MotionConfig>
    </ErrorBoundary>
  );
}
createRoot(document.getElementById('root')).render(<App />);
