import { money } from './api';
export default function Legal({ privacy, prices = [] }) {
  const price = (id, fallback) => money(prices.find((tier) => tier.id === id)?.amount ?? fallback);
  return (
    <main className="section page legal">
      <span className="eyebrow">VICTORIOUS CYBER</span>
      <h1>{privacy ? 'Privacy policy' : 'Terms of service'}</h1>
      <p>Effective date: 8 October 2026. Contact: 0725890432 · vcyber.co.ke.</p>
      {privacy ? (
        <>
          <h2>Information we process</h2>
          <p>
            We process the instructions and files you submit to generate documents, your paying
            phone number, order information, payment receipts and download records. An essential,
            HTTP-only session cookie lets you access your orders. We do not collect your M-PESA PIN.
          </p>
          <h2>AI generation</h2>
          <p>
            Your instructions and extracted CV text are sent to OpenAI when live generation is
            enabled. Do not upload another person’s details without permission, identity documents
            or information unnecessary for the document. Image prompts exclude personal details. No
            advertising trackers are included.
          </p>
          <h2>Retention and security</h2>
          <p>
            Generated personal document files are scheduled for deletion after the 24-hour access
            period. Payment, order and download records are retained for 365 days for customer
            support and accounting, then scheduled for deletion. Administrators can see orders and
            receipts. Files are stored privately and downloads require verified payment and order
            access.
          </p>
          <h2>Your choices</h2>
          <p>
            Contact 0725890432 to request access, correction or deletion of your personal
            information. Some transaction records may need to be retained for accounting or dispute
            resolution. We will update this policy if our services or data practices change.
          </p>
        </>
      ) : (
        <>
          <h2>Services and pricing</h2>
          <p>
            Letters cost {price('letter', 20)} per PDF page. Standard CVs cost {price('cv', 30)} per
            PDF page; Canadian and compressed templates cost {price('premiumCv', 50)} per PDF page.
            CBC activity downloads cost {price('cbc', 10)} per assignment. Marketplace documents
            cost {price('documents', 5)}; software costs {price('software', 100)} and printer tools
            cost {price('resetters', 100)}
            per item. The price shown at checkout is the order price. Future price changes do not
            change an existing quote.
          </p>
          <h2>Review your document</h2>
          <p>
            Review your preview before payment. AI-generated content can contain errors or
            omissions. You are responsible for checking names, dates, qualifications and factual
            accuracy. CBC materials support learning and require teacher or parent review. They are
            not officially endorsed curriculum resources.
          </p>
          <h2>Payments and downloads</h2>
          <p>
            Downloads unlock only after payment verification. You have 24 hours from confirmation to
            download or retrieve the purchase with the paying phone number and receipt code. PDF
            pages determine pricing; Word documents may paginate differently. Payment delays require
            verification; contact support before paying again.
          </p>
          <h2>Resource licenses</h2>
          <p>
            Use files according to their stated license. Buying an installer or utility does not
            grant a third-party software license unless explicitly included. Confirm your printer
            model and utility compatibility before purchase. Do not use the service to distribute
            malware, infringe copyright or bypass software licensing.
          </p>
          <h2>Support and failed delivery</h2>
          <p>
            If you are charged but cannot retrieve a file, contact 0725890432 with your order
            reference and M-PESA receipt. The team will verify the transaction and resolve delivery
            or discuss a refund. Never share your M-PESA PIN.
          </p>
        </>
      )}
      <a className="button primary" href="/">
        Back to Victorious Cyber
      </a>
    </main>
  );
}
