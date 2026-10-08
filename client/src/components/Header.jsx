import { Moon, Sun, Menu, X, Phone } from 'lucide-react';
import { useState } from 'react';
import Logo from './Logo';
export default function Header({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="topbar">
        <span>Your digital services hub</span>
        <a href="tel:+254725890432">
          <Phone size={13} />
          0725 890 432
        </a>
      </div>
      <header className="header">
        <a href="/" aria-label="Victorious Cyber home">
          <Logo />
        </a>
        <nav className={open ? 'nav open' : 'nav'} aria-label="Main navigation">
          <a href="/#studio" onClick={() => setOpen(false)}>
            Document studio
          </a>
          <a href="/#marketplace" onClick={() => setOpen(false)}>
            Resources
          </a>
          <a href="/orders" onClick={() => setOpen(false)}>
            My orders
          </a>
          <a
            href="https://wa.me/254725890432"
            target="_blank"
            rel="noreferrer"
            className="nav-contact"
          >
            Get help
          </a>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button
            className="icon-button mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
    </>
  );
}
