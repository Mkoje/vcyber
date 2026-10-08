import {
  FileText,
  GraduationCap,
  BriefcaseBusiness,
  ShieldCheck,
  Smartphone,
  Download,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { money } from '../api';
export default function Hero({ onSelect, prices = [] }) {
  const price = (id, fallback) => money(prices.find((tier) => tier.id === id)?.amount ?? fallback);
  return (
    <section className="hero">
      <div className="hero-copy">
        <span className="eyebrow">
          <span /> YOUR NEXT STEP STARTS HERE
        </span>
        <h1>
          Big ambitions.
          <br />
          <span>Better documents.</span>
        </h1>
        <p>
          From your next job application to a learner’s next discovery. Create polished documents
          and get the digital tools you need, all in one place.
        </p>
        <div className="hero-actions">
          <a className="button primary" href="#studio">
            Create a document
          </a>
          <a className="button secondary" href="#marketplace">
            Browse resources
          </a>
        </div>
        <div className="hero-trust">
          <span>
            <ShieldCheck size={17} /> Protected downloads
          </span>
          <span>
            <Smartphone size={17} /> M-PESA checkout
          </span>
        </div>
      </div>
      <motion.div
        className="hero-workspace"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="workspace-top">
          <span className="workspace-mark">VC</span>
          <span>Your document workspace</span>
          <span className="workspace-dots">•••</span>
        </div>
        <div className="sample-cv">
          <div className="cv-side">
            <span className="cv-monogram">AM</span>
            <strong>ALEX MORGAN</strong>
            <small>OPERATIONS PROFESSIONAL</small>
            <div className="mini-rule" />
            <b>CONTACT</b>
            <small>
              alex@example.com
              <br />
              Nairobi, Kenya
            </small>
            <b>KEY SKILLS</b>
            <small>
              Project coordination
              <br />
              Customer service
              <br />
              Team leadership
            </small>
          </div>
          <div className="cv-body">
            <span className="cv-template">MODERN CV</span>
            <h3>
              Ready for your
              <br />
              next opportunity.
            </h3>
            <b>PROFILE</b>
            <div className="text-lines">
              <i />
              <i />
              <i />
            </div>
            <b>EXPERIENCE</b>
            <div className="text-lines">
              <i />
              <i />
              <i />
              <i />
            </div>
            <b>EDUCATION</b>
            <div className="text-lines">
              <i />
              <i />
            </div>
          </div>
        </div>
        <div className="workspace-bottom">
          <span>
            <FileText size={16} /> Professional templates
          </span>
          <span className="pill">From {price('cv', 30)} / page</span>
        </div>
      </motion.div>
      <div className="service-strip">
        {[
          {
            icon: FileText,
            title: 'Letters that say it right',
            price: `${price('letter', 20)} / page`,
            kind: 'letter',
          },
          {
            icon: BriefcaseBusiness,
            title: 'CVs that open doors',
            price: `From ${price('cv', 30)} / page`,
            kind: 'cv',
          },
          {
            icon: GraduationCap,
            title: 'Make learning hands-on',
            price: `${price('cbc', 10)} / assignment`,
            kind: 'cbc',
          },
        ].map((s) => (
          <button
            key={s.kind}
            onClick={() => {
              onSelect(s.kind);
              document.querySelector('#studio').scrollIntoView({ behavior: 'smooth' });
            }}
          >
            <span className="service-icon">
              <s.icon size={24} />
            </span>
            <span>
              <strong>{s.title}</strong>
              <small>{s.price}</small>
            </span>
            <span className="service-plus">+</span>
          </button>
        ))}
      </div>
    </section>
  );
}
