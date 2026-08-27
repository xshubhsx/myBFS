# बागवान फ्रूट सप्लायर्स — Billing App

A paper-style digital billing app for Baghwan Fruit Suppliers, built with
plain HTML/CSS/JavaScript. It reproduces the original paper bill layout
(header, contact details, customer box, item table, totals, and footer)
with live calculations, Marathi amount-in-words, bill history, search,
and read-only analytics.

## Run it

No build step needed. Open `index.html` in a browser, or serve the
folder with any static server, e.g. from VS Code's "Live Server"
extension, or:

```bash
cd baghwan-billing
python3 -m http.server 5500
```

Then visit `http://localhost:5500`.

## Pages

- `index.html` — the bill itself (create + submit)
- `history.html` — every saved bill, searchable, with a read-only detail view
- `analytics.html` — read-only totals and breakdowns (never edits data)

## About data storage in this build

This build persists every bill in the browser's `localStorage`
(`js/storage.js`), wrapped in a small Promise-based API
(`window.BFSStorage`) that mirrors what a Firestore layer would look
like. That gives you, right now, with zero setup:

- Bills that survive refresh, browser close, and app restart
- Every bill saved as its own record — old bills are never overwritten
- A separate customer master list, auto-filled by mobile number
- An audit log of create/view actions
- Fully offline-capable (there is no network call to fail)

This is a genuine trade-off worth knowing: `localStorage` is **per
browser, per device** — it will not sync a bill created on one phone
to another phone or to a laptop. If you need bills to be visible from
every device (true "cloud"), wire up real Firebase using the steps
below; nothing else in the app needs to change.

## Upgrading to real Firebase

1. Create a Firebase project → enable **Authentication**, **Firestore**,
   and **Storage**.
2. Copy your web app config into a new `js/firebase.config.js`
   (keep it out of version control) and initialize the Firebase SDK
   there.
3. Rewrite the function bodies inside `js/storage.js` — `saveBill`,
   `getBills`, `getBillById`, `searchBills`, `upsertCustomer`,
   `findCustomerByMobile`, `getCustomers`, `addAuditLog`,
   `getAuditLogs` — to call Firestore (`addDoc`, `getDocs`,
   `onSnapshot`, etc.) instead of `localStorage`. Keep the same
   function names and return shapes; `billing.js`, `history.js`, and
   `analytics.js` never touch storage directly, so they need no
   changes.
4. Deploy `firestore.rules` (a safe starter is already included —
   bills and customers are create/read only from the client, never
   update/delete, so a bill can't be silently overwritten) and enable
   Firestore offline persistence if you want the same offline safety
   this build already has.
5. For "Save Image", `html2canvas` (loaded from cdnjs) already
   generates a PNG of the bill client-side — you can additionally
   upload that PNG to Firebase Storage and store the resulting URL on
   the bill document.

## Test checklist (matches the spec's own test plan)

| # | Test | Expected |
|---|------|----------|
| 1 | वजन 2500, कडता 100, Labour ₹500/ton, भाव ₹40, गाडी भाडे ₹2000 | एकूण वजन 2400 KG, मजुरी ₹1200, एकूण रक्कम ₹96000, देणे रक्कम ₹92800 |
| 2 | Change weight 2500 → 3000 | All dependent fields update instantly |
| 3 | Refresh the page | Previously saved bills still appear in History |
| 4 | Submit a second bill | First bill is untouched in History |
| 5 | Open Bill History | Both bills listed, newest first |
| 6 | Open Analytics | Numbers match; nothing in History changes |
| 7 | Search by mobile number | Only matching bills shown |
| 8 | Save Image (form or history detail) | PNG downloads with the full bill |
| 9 | Turn off Wi-Fi, keep typing | Nothing is lost (there is no network dependency) |
| 10 | Open the browser console | No unexpected errors |

Every calculation above was verified against the exact worked example
in the spec before shipping.

---
Design by Arsul Interpricess
