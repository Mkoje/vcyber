import { useState } from 'react';
import {
  FileText,
  BriefcaseBusiness,
  GraduationCap,
  Sparkles,
  Upload,
  Check,
  LoaderCircle,
  Info,
} from 'lucide-react';
import { api, money } from '../api';
const placeholders = {
  letter:
    'Example: Write a cover letter for a customer service role. My name is Mary Wanjiku. I have 3 years of front desk experience, strong communication skills, and a diploma in business management. Address it to the HR Manager at…',
  cv: 'Your name and contact details, target role, work experience with dates, achievements, education, skills, certifications and languages. Include only details you want in your CV.',
  cbc: 'Example: Create a Grade 4 activity sheet on parts of a plant, with a simple labelled diagram, a drawing task and five practice questions.',
};
export default function AIGenerator({ kind, setKind, onGenerated, configuration }) {
  const [prompt, setPrompt] = useState(''),
    [template, setTemplate] = useState('modern'),
    [grade, setGrade] = useState('Grade 4'),
    [subject, setSubject] = useState('Science & Technology'),
    [illustration, setIllustration] = useState('none'),
    [file, setFile] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [consent, setConsent] = useState(false);
  const priceId =
    kind === 'cv' && ['canadian', 'compressed'].includes(template) ? 'premiumCv' : kind;
  const price =
    configuration?.prices?.find((p) => p.id === priceId)?.amount ||
    { letter: 20, cv: 30, premiumCv: 50, cbc: 10 }[priceId];
  async function generate(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      for (const [k, v] of Object.entries({
        kind,
        template,
        grade,
        subject,
        illustration: kind === 'cbc' ? illustration : 'none',
        prompt: prompt || 'Reformat this existing CV using only its supplied information.',
      }))
        form.append(k, v);
      if (file && kind === 'cv') form.append('cv', file);
      onGenerated(await api('/api/generate-doc', { method: 'POST', body: form }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section id="studio" className="section studio">
      <div className="section-heading">
        <div>
          <span className="eyebrow">THE DOCUMENT STUDIO</span>
          <h2>A blank page. A fresh start.</h2>
          <p>Tell us what you need. Preview your document before you pay.</p>
        </div>
        <span className="section-number">01 / CREATE</span>
      </div>
      <div className="studio-grid">
        <aside className="studio-menu">
          <div className="tab-list" role="tablist" aria-label="Document type">
            {[
              {
                id: 'letter',
                title: 'Letters & applications',
                desc: 'Find the right words',
                icon: FileText,
              },
              {
                id: 'cv',
                title: 'CV & resume builder',
                desc: 'Put your experience first',
                icon: BriefcaseBusiness,
              },
              {
                id: 'cbc',
                title: 'CBC homework maker',
                desc: 'Activities for curious minds',
                icon: GraduationCap,
              },
            ].map((t) => (
              <button
                role="tab"
                aria-selected={kind === t.id}
                tabIndex={kind === t.id ? 0 : -1}
                aria-controls="generator-panel"
                id={'tab-' + t.id}
                key={t.id}
                className={kind === t.id ? 'active' : ''}
                onClick={() => {
                  setKind(t.id);
                  setError('');
                }}
                onKeyDown={(e) => {
                  const tabs = ['letter', 'cv', 'cbc'];
                  let next;
                  if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
                    next = tabs[(tabs.indexOf(kind) + 1) % tabs.length];
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
                    next = tabs[(tabs.indexOf(kind) + tabs.length - 1) % tabs.length];
                  if (e.key === 'Home') next = tabs[0];
                  if (e.key === 'End') next = tabs.at(-1);
                  if (next) {
                    e.preventDefault();
                    setKind(next);
                    setError('');
                    document.getElementById('tab-' + next)?.focus();
                  }
                }}
              >
                <t.icon size={21} />
                <span>
                  <strong>{t.title}</strong>
                  <small>{t.desc}</small>
                </span>
                {kind === t.id && <span className="tab-indicator" />}
              </button>
            ))}
          </div>
          <div className="studio-note">
            <Shield />
            <h4>Your details stay yours.</h4>
            <p>
              Generated documents are available for 24 hours. We send your inputs to our AI provider
              only to create your document.
            </p>
            <a href="/privacy">Read our privacy policy</a>
          </div>
        </aside>
        <form
          className="generator-card"
          id="generator-panel"
          role="tabpanel"
          aria-labelledby={'tab-' + kind}
          onSubmit={generate}
        >
          <div className="generator-title">
            <div>
              <span className="overline">
                {kind === 'letter'
                  ? 'WRITE WITH CONFIDENCE'
                  : kind === 'cv'
                    ? 'YOUR EXPERIENCE, WELL PRESENTED'
                    : 'LEARN BY DOING'}
              </span>
              <h3>
                {kind === 'letter'
                  ? 'What would you like to write?'
                  : kind === 'cv'
                    ? 'Build your next opportunity.'
                    : 'Create a learning activity.'}
              </h3>
            </div>
            <span className="price-badge">
              {money(price)}
              <small> / {kind === 'cbc' ? 'assignment' : 'page'}</small>
            </span>
          </div>
          {kind === 'cv' && (
            <div className="form-row">
              <label>
                Choose your template
                <select value={template} onChange={(e) => setTemplate(e.target.value)}>
                  {['modern', 'executive', 'academic', 'canadian', 'compressed'].map((t) => (
                    <option key={t} value={t}>
                      {t[0].toUpperCase() + t.slice(1)}
                      {['canadian', 'compressed'].includes(t)
                        ? ` — ${money(configuration?.prices?.find((p) => p.id === 'premiumCv')?.amount ?? 50)}/page`
                        : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="upload-label">
                <Upload size={18} /> {file ? file.name : 'Upload an existing CV'}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={(e) => {
                    const selected = e.target.files[0] || null;
                    if (selected && selected.size > 5 * 1024 * 1024) {
                      setError('CV uploads must be below 5 MB.');
                      e.target.value = '';
                      setFile(null);
                    } else {
                      setError('');
                      setFile(selected);
                    }
                  }}
                />
                <small>PDF, DOCX or TXT · max 5 MB</small>
              </label>
            </div>
          )}
          {kind === 'cbc' && (
            <>
              <div className="form-row">
                <label>
                  Grade
                  <select value={grade} onChange={(e) => setGrade(e.target.value)}>
                    {['PP1', 'PP2', ...Array.from({ length: 9 }, (_, i) => 'Grade ' + (i + 1))].map(
                      (g) => (
                        <option key={g}>{g}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Learning area
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    maxLength={100}
                  />
                </label>
              </div>
              <label>
                Visual support
                <select value={illustration} onChange={(e) => setIllustration(e.target.value)}>
                  <option value="none">No illustration</option>
                  <option value="diagram">Labelled concept diagram</option>
                  <option value="image" disabled={!configuration?.imagesEnabled}>
                    Generated educational image
                    {!configuration?.imagesEnabled ? ' — unavailable' : ''}
                  </option>
                </select>
              </label>
            </>
          )}
          <label className="prompt-label">
            {kind === 'cv'
              ? 'Your details & instructions'
              : kind === 'cbc'
                ? 'Describe the assignment'
                : 'Your instructions'}
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholders[kind]}
              rows={6}
              minLength={file && kind === 'cv' ? undefined : 20}
              required={!(file && kind === 'cv')}
              maxLength={12000}
            />
          </label>
          <div className="prompt-helper">
            <span>Be specific for a better result.</span>
            <span>{prompt.length.toLocaleString()} / 12,000</span>
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
            />
            I agree to the <a href="/terms">terms</a> and processing described in the{' '}
            <a href="/privacy">privacy policy</a>.
          </label>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <div className="generator-bottom">
            <span>
              <Info size={16} />
              {kind === 'cbc'
                ? 'One fixed price per assignment.'
                : 'Exact price calculated from PDF pages.'}
            </span>
            <button className="button primary" type="submit" disabled={busy || !consent}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{' '}
              {busy ? 'Creating your preview…' : 'Generate & preview'}
            </button>
          </div>
          {configuration?.demo && (
            <p className="demo-note">
              Local demo: generates sample documents. Your instructions will be used when live AI is
              configured.
            </p>
          )}
        </form>
      </div>
      <div className="steps">
        <span>
          <b>1</b> Describe your document
        </span>
        <span>
          <b>2</b> Review the preview
        </span>
        <span>
          <b>3</b> Pay with M-PESA
        </span>
        <span>
          <b>4</b> Download & go
        </span>
      </div>
    </section>
  );
}
function Shield() {
  return (
    <div className="privacy-icon">
      <Check size={18} />
    </div>
  );
}
