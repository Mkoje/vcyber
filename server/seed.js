import { one, query } from './db.js';
import { renderDocument } from './documents.js';
import { config } from './config.js';
import { id } from './security.js';
// Original templates, not government forms or third-party copyrighted binaries.
export async function seedResources() {
  for (const [title, description, sections] of [
    [
      'Business quotation template',
      'A clear, editable-ready quotation guide for small businesses.',
      [
        {
          heading: 'Quotation details',
          body: 'Quotation number: __________\nDate: __________\nValid until: __________\nPrepared for: __________',
        },
        {
          heading: 'Items and pricing',
          body: 'Description | Quantity | Unit price | Total\n__________ | __________ | __________ | __________\n\nSubtotal: __________\nTax (if applicable): __________\nTotal: __________',
        },
        {
          heading: 'Terms',
          body: 'Payment method: __________\nDelivery timeline: __________\nContact person: __________',
        },
      ],
    ],
    [
      'Job application checklist',
      'A practical checklist to help you prepare a complete application.',
      [
        {
          heading: 'Before you apply',
          body: 'Read the job description.\nCheck the deadline.\nMatch your skills to the role.\nConfirm the employer’s official application channel.',
        },
        {
          heading: 'Your documents',
          body: 'Tailor your CV.\nWrite a relevant cover letter.\nName files clearly.\nProofread dates and contact details.\nAttach only documents requested by the employer.',
        },
        {
          heading: 'Final check',
          body: 'Do not pay recruitment fees without verifying legitimacy.\nKeep a copy of your submitted application.\nTrack the date and application reference.',
        },
      ],
    ],
    [
      'Weekly study planner',
      'Plan subjects, practice sessions and weekly learning goals.',
      [
        {
          heading: 'My goals this week',
          body: '1. ____________________\n2. ____________________\n3. ____________________',
        },
        {
          heading: 'Daily plan',
          body: 'Monday: ____________________\nTuesday: ____________________\nWednesday: ____________________\nThursday: ____________________\nFriday: ____________________\nSaturday: ____________________\nSunday: ____________________',
        },
        {
          heading: 'Review',
          body: 'What went well? ____________________\nWhat should I practise next? ____________________',
        },
      ],
    ],
  ]) {
    if (await one('SELECT id FROM resources WHERE title=$1 AND category=$2', [title, 'documents']))
      continue;
    const resourceId = id();
    const rendered = await renderDocument(
      resourceId,
      {
        title,
        subtitle: 'Victorious Cyber • Original resource',
        sections,
        diagram: { nodes: [], connections: [] },
      },
      'modern',
    );
    await query(
      'INSERT INTO resources(id,title,category,description,price,file_path,original_name,active,license,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,1,$8,$9)',
      [
        resourceId,
        title,
        'documents',
        description,
        5,
        rendered.pdfPath,
        title.toLowerCase().replaceAll(' ', '-') + '.pdf',
        'Victorious Cyber original. Personal and business use allowed; resale prohibited.',
        Date.now(),
      ],
    );
  }
  for (const [title, category, description] of [
    [
      'Office & productivity utilities',
      'software',
      'Productivity tools for everyday work. Contact us for available installers.',
    ],
    [
      'Printer adjustment utility',
      'resetters',
      'Printer maintenance tools. Ask our team about your model and compatibility.',
    ],
  ]) {
    if (await one('SELECT id FROM resources WHERE title=$1 AND category=$2', [title, category]))
      continue;
    await query(
      'INSERT INTO resources(id,title,category,description,price,active,license,created_at) VALUES($1,$2,$3,$4,100,0,$5,$6)',
      [
        id(),
        title,
        category,
        description,
        'Only authorised distribution is permitted.',
        Date.now(),
      ],
    );
  }
}
