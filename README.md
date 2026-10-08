# Victorious Cyber

A complete React + Express application for **vcyber.co.ke**, contact **0725890432**. Includes a vector shield/circuit logo, responsive light/dark interface, document and CV generation, CBC learning sheets with diagrams or generated images, a private resource marketplace, M-PESA STK checkout, 24-hour purchase retrieval, and an administrator dashboard.

## Start on your laptop

Install **Node.js 24 LTS** and **Poppler** (`pdftoppm` and `pdftotext` must be on PATH).

- Windows: install Poppler via your trusted package manager or [the documented Windows build](https://github.com/oschwartz10612/poppler-windows), then add its `Library/bin` directory to PATH. Restart your terminal and verify `pdftoppm -v` and `pdftotext -v`.
- Ubuntu/Debian: `sudo apt-get install poppler-utils fonts-liberation`
- macOS: `brew install poppler`

Open this folder in VS Code or IntelliJ, then run:

```bash
npm ci
```

Copy `.env.example` to `.env`:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```bash
# macOS/Linux
cp .env.example .env
```

Start both frontend and backend:

```bash
npm run dev
```

Open **http://localhost:5173**. `DEMO_MODE=true` is explicit in `.env.example`; it uses a local, persistent SQLite database and sample document output. The demo checkout does not contact Safaricom or charge money. Click **Simulate successful payment** to test private PDF/DOCX downloads and receipts. No default admin login exists.

If you use `npm start` instead, first build the frontend with `npm run build` and set `APP_URL=http://localhost:3001` to match the origin you open. Always run commands from this project folder. Development accepts localhost and 127.0.0.1 on the configured port; production requires the exact APP_URL origin.

## Create your admin

Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 14 characters in `.env`, then run:

```bash
npm run admin:create
```

Open `/admin`. Remove `ADMIN_PASSWORD` from `.env` after creating the account. Passwords are bcrypt hashed; admin sessions expire in eight hours and the session cookie rotates on login. The dashboard shows revenue, payments for the current Kenyan day, download count, orders, resource availability and editable price tiers. Uploading requires a title, description, distribution license and the actual file. Production uploads fail closed unless ClamAV scans them successfully.

Use **Manage resources** to edit titles, descriptions and licenses, download uploaded files, replace a file, and publish/unpublish a listing. Unpublished uploaded files are hidden from the public marketplace. Replacing a file preserves the original download for existing purchases. Missing-file placeholders require an upload before publication. Uploads support documents and software packages up to 100 MB.

If the IDE cannot find Poppler despite it being installed, set `POPPLER_BIN` in `.env` to the absolute directory containing `pdftoppm` and `pdftotext`. The configured Windows installation uses its `Library/bin` directory. The development server now requires port 5173 to be available so it cannot silently change to an origin rejected by the backend.

## Android administrator app

The Android Studio project is in `android-admin/`. An installable APK and a copy of the Android project are also supplied in **Desktop → New folder**. Read `android-admin/README.md` for installation, server connection and rebuilding instructions. The app opens the same authenticated dashboard, supports native Android file selection and file downloads, and shares the website's accounts and resource library. It requires the website backend to be running and reachable; no credentials are embedded in the APK. The delivered APK is a signed development build for local installation.

## Live AI and payments

The source implements real API calls, but no credentials are bundled. Live provider calls have **not** been exercised with your accounts. Configure and run the sandbox acceptance steps below before collecting customer payments.

1. Provision a PostgreSQL database. Set `DATABASE_URL`. For managed TLS PostgreSQL, set `DATABASE_SSL=true` and use a trusted CA; do not disable certificate verification.
2. Set `DEMO_MODE=false`, `OPENAI_API_KEY`, and an enabled `OPENAI_MODEL` that supports Responses structured outputs. The default model is configurable, not a guarantee of account availability. Inputs are sent with `store:false` and the response is validated before rendering.
3. Optional CBC illustrations: set `AI_IMAGES_ENABLED=true` and an accessible `OPENAI_IMAGE_MODEL`. The interface enables generated images only when configured. Concept diagrams are generated from bounded, labelled nodes without arbitrary SVG/HTML from the model. Image API costs are paid by you; choose your customer pricing accordingly.
4. Register a Daraja app and use **sandbox** credentials first. Set `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, `MPESA_PAYBILL`, and the transaction type agreed with Safaricom (`CustomerPayBillOnline` by default). A business phone number alone is not a Daraja shortcode.
5. Generate a random callback secret of at least 32 characters, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Set `MPESA_CALLBACK_SECRET`. Keep it out of logs.
6. Set `MPESA_CALLBACK_URL=https://vcyber.co.ke/api/mpesa/callback` (or your publicly reachable sandbox host) and `APP_URL=https://vcyber.co.ke`. The server appends `?secret=<secret>` to the callback URL sent to Safaricom. A local URL cannot receive provider callbacks without a public HTTPS tunnel.
7. Obtain production credentials and confirm the production shortcode/passkey with Safaricom before setting `MPESA_ENV=live`. Sandbox confirmation is not evidence that live money was received.

### Payment integrity

All prices and PDF page counts are calculated on the server. Browser-supplied amounts are ignored. Quotes are immutable even if the admin changes a tier later. Success responses from the STK initiation endpoint do **not** unlock downloads.

Payment initiation atomically claims an unpaid order. Callbacks must match stored checkout and merchant IDs, amount, payer and receipt. STK callbacks do not provide a cryptographic signature; the app uses a high-entropy callback URL secret and independently checks STK status with Daraja before settlement. Receipts are unique. Repeated callbacks are idempotent. A background reconciler retries persisted callbacks and resolves unsuccessful pending requests. Unknown initiation timeouts are held for staff review to avoid charging twice.

A successful status query without a callback cannot establish the receipt or payer metadata, so it stays in REVIEW and does not automatically unlock a file. Staff should compare the actual merchant statement to the order, not a customer screenshot. The `/api/admin/confirm-receipt` endpoint then accepts an authenticated staff submission with `{attemptId, receipt, phone, amount, note}`; it still requires a successful independent Daraja query and writes an audit event. The note must describe the statement verification (at least 20 characters). There is no public “mark paid” endpoint. An initiation timeout with no checkout ID must be resolved with Safaricom before retrying.

Customers retrieve a purchase with **both** the paying phone number and receipt code within 24 hours. Phone-only retrieval would expose other people’s files. Session owners can reopen orders without re-entering a receipt. Receipt recovery transfers the purchase to the recovering session. Downloads are logged and access expires 24 hours after payment. Transaction, download and audit metadata are scheduled for deletion after 365 days.

## Prices

| Service                               | Price                        |
| ------------------------------------- | ---------------------------- |
| Letter                                | KSh 20 per rendered PDF page |
| Standard/Modern/Executive/Academic CV | KSh 30 per rendered PDF page |
| Canadian/Compressed CV                | KSh 50 per rendered PDF page |
| CBC activity sheet                    | KSh 10 per assignment        |
| Marketplace document                  | KSh 5 per item               |
| Software                              | KSh 100 per item             |
| Printer utility                       | KSh 100 per item             |

The PDF is the billing authority. DOCX is editable and may paginate differently in Word/LibreOffice. Preview images show every rendered PDF page; no clean document text is returned to the browser before payment. The three bundled marketplace PDFs are original templates. Software/reset listings are deliberately unavailable until you upload authorised, licensed files. No third-party installers, printer reset binaries or government forms are bundled.

## Production deployment

Deployment is prepared for **your own hosting**; this source ZIP is not a published site. Supply your domain, credentials, hosting and production database.

The Docker image installs Poppler and ClamAV and runs Node as an unprivileged user. `compose.yaml` supplies PostgreSQL, persistent file storage and a one-time antivirus signature update.

1. Copy `.env.example` to `.env`; configure live settings as above, `NODE_ENV=production`, `DEMO_MODE=false`, and `POSTGRES_PASSWORD` as a strong hexadecimal password (avoids URL-escaping ambiguity).
2. Use `APP_URL=https://vcyber.co.ke`, correct callback URL and sandbox or live credentials as appropriate.
3. Run `docker compose up -d --build`. The app refuses demo mode in production and refuses missing AI/payment/database configuration. If the antivirus update fails, investigate it before starting the app.
4. Provision TLS and configure your reverse proxy using `deploy/nginx.conf`. The Node port is bound to localhost; exactly one trusted nginx proxy is assumed. Adapt Express `trust proxy` to your hosting topology if it differs.
5. Run `docker compose exec app npm run admin:create` after setting admin provisioning variables; remove the provisioning password and recreate the app container afterwards.
6. Refresh antivirus signatures daily using `docker compose run --rm antivirus-update`. Configure this in your host’s scheduler.
7. Back up **both** the PostgreSQL volume and private file volume; test restoring them. Protect the private volume and database at rest using your host’s encryption controls. Do not expose `/app/storage` through nginx.
8. Confirm actual business hours, revise terms/privacy and your refund process, confirm the 365-day transaction-record retention policy, and verify distribution rights for each uploaded resource. Hours are shown as “contact us to confirm” rather than fabricated.

The app runs as a **single Node instance**. Rate limiting is in memory; the reconciliation worker is in process. Before horizontal scaling, add a shared rate-limit store and move reconciliation/cleanup to a queue with job locking. This ZIP does not claim multi-region availability or audited regulatory compliance. Long-running document generation is synchronous with timeouts; plan a job queue for heavy load.

## Sandbox acceptance checks before launch

- Create a letter, each CV template, an uploaded PDF/DOCX CV, a CBC sheet with diagram, and (if enabled) an image. Verify real content, page counts, previews and exported files.
- Test successful payment, wrong PIN, cancellation, insufficient funds, slow callback, duplicate callback, mismatched metadata, lost callback, and an initiation timeout.
- Confirm a pending/unpaid order never downloads; another session cannot preview or download it; an expired order cannot be retrieved.
- Verify a real sandbox callback through your public HTTPS host and independently inspect the Daraja query and your merchant-side records. Run a small live test only after production activation.
- Upload an approved file; test a known antivirus test file in an isolated environment; confirm the upload scanner fails closed when signatures/scanner are missing.
- Review mobile and desktop, keyboard navigation, reduced motion and both themes. Server access control remains authoritative.

## Tests

```bash
npm test
npm run build
```

Backend integration tests cover phone validation, immutable prices, billing, private previews/downloads, explicit demo checkout, receipt recovery, expiry, admin login and CBC diagrams.

For browser tests, install the Playwright browser and start a separate demo server:

```bash
npx playwright install chromium
# Set these in your terminal, or temporarily in .env:
# DEMO_MODE=true, APP_URL=http://127.0.0.1:3002, PORT=3002
npm start
# In a second terminal:
npm run test:browser
```

Browser screenshots are written outside the source tree (`/tmp/vcyber-browser` by default; set `QA_DIR` on Windows). Browser tests require a configured demo app at `BASE_URL` (default `http://127.0.0.1:3002`).

To build and run complete browser acceptance against an isolated temporary demo database without manually starting a second server:

```powershell
npm run build
npm run test:browser:local
```

This checks document generation, every CV template, uploaded PDF/DOCX CVs, paid exports, legal/unknown routes, keyboard tabs, themes, mobile layout and authenticated document/software management. It does not call live providers or alter your application database. Screenshots use your OS temporary directory under `vcyber-browser`.

With an Android emulator running and the debug APK built, run the Android acceptance check:

```powershell
$env:ACCEPTANCE_TARGET='android'
npm run test:browser:local
Remove-Item Env:ACCEPTANCE_TARGET
```

The Android check installs the debug APK in the emulator and verifies server selection, sign-in, native file-picker upload, mobile layout, unpublishing and logout against that isolated demo server.

## Code map

```text
client/src/components/  Header, Hero, Logo, AIGenerator, Marketplace,
                       PreviewModal, PaymentModal, Modal, Footer
client/src/Admin.jsx   Authentication, uploads, prices, business statistics
client/src/Orders.jsx  History, recovery, download checkout
client/src/Legal.jsx   Editable policy and terms pages
client/src/styles.css Tailwind v4 setup plus complete custom theme and responsiveness
server/app.js          API routing, validation, access control and admin operations
server/ai.js           Structured OpenAI generation and optional educational images
server/documents.js    PDF/DOCX rendering, concept diagrams, watermarked raster previews
server/mpesa.js        OAuth, STK push/query, callback validation and reconciliation
server/uploads.js      CV text extraction, bounded DOCX decompression, production scanning
server/db.js           Parameterized PostgreSQL / local-demo SQLite adapter
server/security.js     Sessions, phone normalization, CSRF and order access
server/index.js        Boot, reconciliation, expired-document cleanup
server/create-admin.js Admin provisioning (no hardcoded login)
database/schema.sql   Schema, indexes and constraints
public/logo.svg       Editable vector brand logo
public/favicon.svg    Shield/bolt favicon
```

Primary routes: `POST /api/generate-doc`, `POST /api/mpesa/stkpush`, `POST /api/mpesa/callback`, `GET /api/download`. Additional routes support config, resources, orders, previews, receipts, recovery, admin management and health.

## Preview protections and limits

Preview images are watermarked and compressed; selection, right-click, dragging and print output are discouraged in the preview. A website **cannot reliably block operating-system screenshots, cameras or all copying**, and disabling global keyboard shortcuts would harm accessibility. Clean files stay private on the server until payment; that is the effective access control. Generated files contain the business name rather than platform watermarks or AI branding. Legal disclosure describes AI processing.

CBC diagrams are labelled **concept diagrams**, not guaranteed anatomically accurate drawings. The image option uses generated educational imagery; no image search catalog or scraped third-party assets are included. Scanned-image CVs require pasting the text; OCR is not bundled.

## Integration references

- [Safaricom Daraja](https://developer.safaricom.co.ke/)
- [Safaricom STK Push and Query SDK reference](https://github.com/safaricom/mpesa-php-sdk/blob/master/src/Mpesa.php)
- [OpenAI Responses structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)

Your application source is supplied for your use and modification. Third-party packages retain their own licenses.
