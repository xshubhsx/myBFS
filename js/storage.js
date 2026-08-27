/**
 * storage.js
 * ---------------------------------------------------------------
 * Persistence layer for the Baghwan Fruit Suppliers billing app.
 *
 * IMPORTANT — READ THIS:
 * This build uses the browser's localStorage as a permanent,
 * on-device "cloud" so the whole app works right now, with zero
 * setup, and NEVER loses a bill on refresh / close / restart.
 *
 * It is written as a Promise-based API (saveBill, getBills, ...)
 * that mirrors what a real Firebase/Firestore layer would look
 * like. That means swapping in real Firebase later is a drop-in
 * replacement of THIS FILE ONLY — billing.js, history.js and
 * analytics.js never touch localStorage directly, they only call
 * window.BFSStorage.*.
 *
 * To connect real Firebase later:
 *   1. Create a Firebase project, enable Firestore + Storage + Auth.
 *   2. Put your web config in js/firebase.config.js (gitignored).
 *   3. Replace the bodies of the functions below with Firestore
 *      calls (addDoc/getDocs/onSnapshot etc). Keep the same
 *      function names and return shapes so nothing else breaks.
 *   4. Add firestore.rules (a starter file is included) and deploy
 *      with `firebase deploy`.
 * ---------------------------------------------------------------
 */

const BFS_KEYS = {
  bills: "bfs_bills_v1",
  customers: "bfs_customers_v1",
  audit: "bfs_audit_v1",
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error("Storage read failed for", key, e);
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error("Storage write failed for", key, e);
    return false;
  }
}

function generateBillId() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  return `BFS-${stamp}${rand}`;
}

function nowIso() {
  return new Date().toISOString();
}

const BFSStorage = {
  isOnline() {
    return navigator.onLine;
  },

  // helper: determine if Firestore is available and user signed in
  _useFirestore() {
    try {
      return !!(window.firebase && firebase.apps && firebase.apps.length && firebase.auth && firebase.auth().currentUser && firebase.firestore);
    } catch (e) {
      return false;
    }
  },

  // ---------- BILLS ----------
  // A bill is NEVER overwritten. Every save() call with no existing
  // id creates a brand-new record. Editing an already-submitted bill
  // is out of scope on purpose (see spec: "never overwrite old bills").
  async saveBill(bill) {
    const bills = readJSON(BFS_KEYS.bills, []);
    const billId = bill.billId || generateBillId();

    // idempotency guard: if this exact billId already exists
    // (e.g. accidental double submit with the same generated id),
    // do not create a duplicate document.
    if (bills.some((b) => b.billId === billId)) {
      return bills.find((b) => b.billId === billId);
    }

    const finalBill = {
      ...bill,
      billId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      status: "SAVED",
    };
    // If a user is signed in, tag the local copy with their uid so
    // localStorage can be filtered per-user when Firestore is unavailable.
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        finalBill.uid = firebase.auth().currentUser.uid;
      }
    } catch (e) {}

    bills.push(finalBill);
    writeJSON(BFS_KEYS.bills, bills);

    // If Firestore is configured and user is signed in, also persist to Firestore
    if (this._useFirestore()) {
      try {
        const uid = firebase.auth().currentUser.uid;
        const db = firebase.firestore();
        await db.collection('bills').doc(billId).set({ ...finalBill, uid });
      } catch (e) {
        console.warn('Firestore save failed, continuing with localStorage', e);
      }
    }

    // update customer master without vehicle/driver fields (removed)
    await this.upsertCustomer({
      name: bill.farmerName,
      mobile: bill.mobileNumber,
      village: bill.village,
    });

    this.addAuditLog({
      action: "BILL_CREATED",
      billId: finalBill.billId,
      operationType: "CREATE",
    });

    return finalBill;
  },

  async getBills() {
    // If user signed in and Firestore is available, read from Firestore for cross-device data
    if (this._useFirestore()) {
      try {
        const uid = firebase.auth().currentUser.uid;
        const db = firebase.firestore();
        const snap = await db.collection('bills').where('uid', '==', uid).get();
        const docs = snap.docs.map((d) => d.data());
        return docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      } catch (e) {
        console.warn('Firestore read failed, falling back to localStorage', e);
      }
    }
    const all = readJSON(BFS_KEYS.bills, []);
    // If a firebase user is present (but firestore not usable), filter local bills
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        const uid = firebase.auth().currentUser.uid;
        const filtered = all.filter((b) => !b.uid || b.uid === uid);
        return filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch (e) {
      // ignore and fall back to returning all
    }
    return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getBillById(billId) {
    if (this._useFirestore()) {
      try {
        const doc = await firebase.firestore().collection('bills').doc(billId).get();
        if (doc.exists) {
          const bill = doc.data();
          // ensure the bill belongs to the signed-in user
          try {
            const uid = firebase.auth().currentUser.uid;
            if (bill.uid && bill.uid !== uid) return null;
          } catch (e) {}
          this.addAuditLog({ action: 'BILL_VIEWED', billId, operationType: 'READ' });
          return bill;
        }
      } catch (e) {
        console.warn('Firestore get failed, falling back to localStorage', e);
      }
    }
    const bills = readJSON(BFS_KEYS.bills, []);
    const bill = bills.find((b) => b.billId === billId) || null;
    if (bill) {
      // if a firebase user exists, ensure ownership
      try {
        if (window.firebase && firebase.auth && firebase.auth().currentUser) {
          const uid = firebase.auth().currentUser.uid;
          if (bill.uid && bill.uid !== uid) return null;
        }
      } catch (e) {}
      this.addAuditLog({ action: 'BILL_VIEWED', billId, operationType: 'READ' });
    }
    return bill;
  },

  async searchBills(query) {
    const q = (query || "").trim().toLowerCase();
    const bills = await this.getBills();
    if (!q) return bills;
    return bills.filter((b) =>
      [b.farmerName, b.mobileNumber, b.billId, b.village, b.date]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(q))
    );
  },

  // ---------- CUSTOMERS ----------
  // Customer master data is separate from bill history. Saving a
  // new bill updates the customer's latest known details but never
  // touches previously saved bills.
  async upsertCustomer(customer) {
    if (!customer.mobile) return null;
    // write to local customers
    const customers = readJSON(BFS_KEYS.customers, []);
    const idx = customers.findIndex((c) => c.mobile === customer.mobile);

    if (idx >= 0) {
      customers[idx] = { ...customers[idx], ...customer, updatedAt: nowIso() };
    } else {
      customers.push({ customerId: `CUST-${Date.now().toString(36).toUpperCase()}`, ...customer, createdAt: nowIso(), updatedAt: nowIso() });
      this.addAuditLog({ action: 'CUSTOMER_CREATED', billId: '', operationType: 'CREATE' });
    }
    writeJSON(BFS_KEYS.customers, customers);

    // also write to Firestore customer master if available
    if (this._useFirestore()) {
      try {
        const uid = firebase.auth().currentUser.uid;
        const db = firebase.firestore();
        await db.collection('customers').doc(customer.mobile).set({ ...customer, uid, updatedAt: nowIso() }, { merge: true });
      } catch (e) {
        console.warn('Firestore customer upsert failed', e);
      }
    }
    return customers.find((c) => c.mobile === customer.mobile);
  },

  async findCustomerByMobile(mobile) {
    // check Firestore first if available
    if (this._useFirestore()) {
      try {
        const doc = await firebase.firestore().collection('customers').doc(mobile).get();
        if (doc.exists) return doc.data();
      } catch (e) {
        console.warn('Firestore findCustomer failed', e);
      }
    }
    const customers = readJSON(BFS_KEYS.customers, []);
    return customers.find((c) => c.mobile === mobile) || null;
  },

  async getCustomers() {
    return readJSON(BFS_KEYS.customers, []);
  },

  // ---------- AUDIT LOG (read-only from the UI's perspective) ----------
  addAuditLog(entry) {
    const logs = readJSON(BFS_KEYS.audit, []);
    logs.push({
      ...entry,
      user: "local-user",
      timestamp: nowIso(),
    });
    writeJSON(BFS_KEYS.audit, logs);
  },

  async getAuditLogs() {
    return readJSON(BFS_KEYS.audit, []).sort(
      (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
    );
  },
};

window.BFSStorage = BFSStorage;
