import { MessageCircle, Phone, Globe } from 'lucide-react';
import Logo from './Logo';
export default function Footer() {
  return (
    <>
      <section className="support-banner">
        <div>
          <span className="eyebrow">REAL PEOPLE. READY TO HELP.</span>
          <h2>Need a hand with something?</h2>
          <p>Get friendly support from the Victorious Cyber team.</p>
        </div>
        <a
          className="button light"
          href="https://wa.me/254725890432"
          target="_blank"
          rel="noreferrer"
        >
          <MessageCircle size={20} />
          Let’s talk on WhatsApp
        </a>
      </section>
      <footer>
        <div className="footer-grid">
          <div>
            <a href="/" aria-label="Victorious Cyber home">
              <Logo />
            </a>
            <p>
              Your cyber cafe and digital solutions hub.
              <br />
              Practical tools for work, learning and everyday life.
            </p>
          </div>
          <div>
            <h4>Explore</h4>
            <a href="/#studio">Document studio</a>
            <a href="/#marketplace">Digital resources</a>
            <a href="/orders">Orders & receipts</a>
          </div>
          <div>
            <h4>Contact us</h4>
            <a href="tel:+254725890432">
              <Phone size={15} />
              0725 890 432
            </a>
            <a href="https://vcyber.co.ke">
              <Globe size={15} />
              vcyber.co.ke
            </a>
            <span>Business hours: contact us to confirm</span>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Victorious Cyber. All rights reserved.</span>
          <div>
            <a href="/terms">Terms of service</a>
            <a href="/privacy">Privacy policy</a>
            <a href="/admin">Admin</a>
          </div>
        </div>
      </footer>
      <a
        className="whatsapp-float"
        href="https://wa.me/254725890432"
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with Victorious Cyber on WhatsApp"
      >
        <MessageCircle size={26} />
      </a>
    </>
  );
}
