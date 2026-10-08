# Validation record

Validated on 8 October 2026 with Node.js 24.

- Vite production frontend build passed.
- 15 backend integration tests passed, covering Kenyan phone validation, cross-origin mutation rejection, price integrity, rendered PDF billing, private watermarked previews, unpaid and cross-session download blocking, demo checkout, 24-hour recovery/expiry, admin authentication, resource uploads, price changes, CBC diagrams, bounded DOCX extraction, and independently verified mocked Daraja callbacks.
- Production dependency audit: zero known vulnerabilities at the time of validation.
- Browser checks passed for CV generation, preview, simulated payment, PDF/DOCX download links, search and empty states, dark mode, mobile navigation, order history and admin login/upload.
- Desktop (1440px) and mobile (390px) screens were visually reviewed. Mobile document width did not overflow the viewport.
- Dependency lockfile consistency checked with `npm ci --dry-run`.

Not exercised with live credentials: OpenAI text/image generation, Safaricom sandbox or live payments, a deployed PostgreSQL instance, Docker deployment, public HTTPS callbacks and production antivirus scanning. Run the README sandbox/deployment checks before public launch. Mocked tests verify application behaviour and do not establish that a live merchant account is configured correctly.

Screenshots in this folder show local demo data, not live customer information.

Current website and Android review: see functional-review.md. Screenshots from the latest checks are in qa-2026-10-08/.
