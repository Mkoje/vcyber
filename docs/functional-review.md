# Website and Android validation � 8 October 2026

Implemented and saved in the website project:

- Fixed Windows PDF rendering/text extraction startup with POPPLER_BIN in .env; documented the optional setting.
- Kept the Vite development origin on port 5173 instead of silently using an incompatible port.
- Expanded /admin with document/software uploads, listing edits, private uploaded-file downloads, replacement files and publish/unpublish controls. The authenticated admin API exposes all listings without leaking private filesystem paths.
- Unpublished uploaded resources are hidden from the public marketplace. Missing files cannot be published. Replacements preserve the original files for existing customer purchases.
- Added file/license information before purchase, client file-size checks, keyboard tab navigation, modal focus handling, expired-order messaging, order refresh after payment, clearer upload errors, safer sign-out handling and reconciliation error recovery.
- Homepage, CV template labels, upload categories and terms pricing now use the current admin price tiers instead of stale fixed amounts.
- M-PESA credentials and payment settlement logic were left unchanged.

Validation completed in this session:

- npm test: 15 integration tests passed.
- npm run build: production frontend build passed.
- npm run test:browser:local: isolated demo browser acceptance passed, including all five CV templates, letter and CBC diagram generation, watermarked previews, actual PDF/DOCX exports, uploaded PDF/DOCX CVs, search, themes, legal and unknown routes, keyboard tabs, mobile layouts, admin sign-in, document/software uploads, listing edits, replacement, publish/unpublish and logout.
- npm audit: zero reported vulnerabilities. npm ci --dry-run passed.
- Android Gradle assembleDebug and lintDebug passed. APK signature verification passed.
- Android emulator acceptance passed: app launch, configurable server, sign-in, native Android system file-picker upload, mobile layout, unpublish and logout. It used an isolated temporary demo database, not customer data.

Delivery: Desktop/New folder/Victorious-Cyber-Admin.apk, README.md, and the VictoriousCyberAdmin Android Studio source project. The repository source is also retained in android-admin/.

The APK is a signed development build for local installation, with a configurable server address and no embedded admin credentials. It requires a running reachable backend. The app defaults to https://vcyber.co.ke; this source has not been deployed there. Release signing/Play Store publication was not performed.

Current .env remains DEMO_MODE=true. OPENAI_API_KEY and DATABASE_URL are not configured. Real AI generation needs your OpenAI credentials; production needs hosting, PostgreSQL, HTTPS and production upload scanning. M-PESA details remain for you to supply. Live AI, live/sandbox provider payments, production deployment and antivirus checks were not exercised. Demo checkout never charges money.

After restarting the computer, run npm run dev in the website project and open http://localhost:5173/admin. Administrator: v.cmwiki@gmail.com. Its password is in storage/admin-credentials.txt, outside the Android delivery and ignored by source control.

Screenshots from this session are saved in docs/qa-2026-10-08/. The earlier local server-start policy rejection was resolved in this session; browser and emulator checks subsequently ran successfully.
