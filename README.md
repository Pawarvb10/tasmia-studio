# Tasmia Designers · Studio — Boutique Order-to-Billing (v3.1)

A single-file web app for a tailoring boutique. It covers the whole flow from a client's first visit to the final invoice: family CRM, article-wise measurements on diagrams, design approval, production planning by worker bandwidth, trials and alterations, QC, delivery, payments and invoices.

No install and no server. Open `index.html` in Chrome or Edge, choose **Load demo studio**, and sign in as Owner with PIN **1111**.

## What's new in v3.1

- **Measurement diagrams.** Every measurement on the studio's printed sheets has its own 2D diagram, in the same order and with the same title as the sheet: Blouse (24), Top (25), Bottom (20) and Mens (25). "Length / Round" items take two values. Each article can be measured in inches or cm; switching converts the values entered so far.
- **Article-wise orders.** Select client → add article → choose the family member → quantity → enter measurements on the diagrams → add the next article. One order can hold two blouse types, a top and bottom for a daughter, and a kurta for a husband, each with its own quantity and measurements.
- **Family CRM.** Each customer is the primary member and can have family members, each with a relation, gender, date of birth (age is worked out automatically), phone and notes. Measurements are stored per member, per article, with version history.
- **Invoices in the studio's format.** The order-details table has the studio's charge columns: Basic Stitching, Patterning, Work, Hangings, Fabric, Dyeing, Alterations, Saree Fall & Picco, Tassels, Steam Press, Drywash and Others. Each column shows the charge for one piece, then quantity and total. Each article has a line describing the work. The summary deducts the discount and referral discount to give the amount payable, followed by payment details, notes (delivery date, trial date, special instructions) and a thank-you footer. The PDF is landscape A4.

## Modules

| Area | What it does |
|---|---|
| Orders & garments | Article-wise booking, each garment with its own file: measurements, specs, design versions and customer approval, workflow, materials, trials, QC, billing and change history |
| Customers & family | Household CRM with members and relations, measurement sets per member and article, alteration history, customer-supplied materials |
| Production | Production board, stitching & delivery planner, embroidery & handwork queue, trials & alterations, QC & delivery handover |
| Resources | Workers (skills, hours, efficiency, leave, piece/hourly pay, ledger), outside vendors, materials & stock |
| Money | Payments and receipts, invoices (whole order or per garment), owner reports |
| Studio | Design catalogue (stencils, samples, 3D, 360°), garment types (measurement sheets, specs, components, workflow), SMS / WhatsApp presets, setup (shop profile, calendar, QC checklist, billing heads, users & roles, backups) |

## Storage

- **On one device:** data is saved in the browser (localStorage + IndexedDB), with a separate PIN login for each staff member.
- **Shared link (Claude artifact):** uses a central database, so every phone and computer sees the same data. Each person signs in with their own account and the owner grants roles. Setup changes are limited to admins.
- Data from an earlier version is converted automatically: family members are created from existing profiles, article sheets are attached to garment types, and the old billing heads are mapped onto the new invoice columns.

## Develop

The app is built from the files in `src/` into the root `index.html`:

```bash
python3 build.py
```

`test/t1.py` … `test/t6.py` are Playwright smoke tests: logic, full workflow and PDFs, central-database mode (with `mock.js`), mobile layout, the measurement and family flow, and invoices. Screenshots and PDFs are written to `test/out/`. `test/t2.py` also uploads two local images; change those paths before running it.

The earlier v1/v2 proof of concept lives in [boutique-order-to-billing](https://github.com/Pawarvb10/boutique-order-to-billing).

## Notes

- WhatsApp / SMS messages open with the text already filled in, and a person presses send. Sending fully automatically would need a WhatsApp Business / SMS gateway.
- GST is added only when a GST % is set. Confirm the rate and SAC code with your CA before using the invoices for real.
