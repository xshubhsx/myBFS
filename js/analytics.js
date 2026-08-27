/**
 * analytics.js — READ-ONLY analytics.
 * This file must never call saveBill/upsertCustomer or otherwise
 * mutate stored data. It only reads via BFSStorage.getBills().
 */

function fmt(n) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function computeAggregates(bills) {
  const agg = {
    totalBills: bills.length,
    totalWeight: 0,
    totalSales: 0,
    totalLabour: 0,
    totalPayable: 0,
    byDate: {},
    byMonth: {},
    byProduct: {},
    byCustomer: {},
  };

  bills.forEach((b) => {
    agg.totalWeight += Number(b.totalWeight) || 0;
    agg.totalSales += Number(b.totalAmount) || 0;
    agg.totalLabour += Number(b.totalLabour) || 0;
    agg.totalPayable += Number(b.payableAmount) || 0;

    const dateKey = b.date || "-";
    agg.byDate[dateKey] = (agg.byDate[dateKey] || 0) + (Number(b.totalAmount) || 0);

    const parts = (b.date || "").split("/");
    if (parts.length === 3) {
      const monthKey = `${parts[1]}/${parts[2]}`;
      agg.byMonth[monthKey] = (agg.byMonth[monthKey] || 0) + (Number(b.totalAmount) || 0);
    }

    (b.items || []).forEach((it) => {
      const key = it.productType || "इतर";
      if (!agg.byProduct[key]) agg.byProduct[key] = { qty: 0, sales: 0 };
      agg.byProduct[key].qty += Number(it.totalWeight) || 0;
      agg.byProduct[key].sales += Number(it.amount) || 0;
    });

    const custKey = `${b.farmerName} (${b.mobileNumber})`;
    if (!agg.byCustomer[custKey]) agg.byCustomer[custKey] = { bills: 0, sales: 0 };
    agg.byCustomer[custKey].bills += 1;
    agg.byCustomer[custKey].sales += Number(b.totalAmount) || 0;
  });

  return agg;
}

function renderStatCards(agg) {
  const stats = [
    { label: "एकूण बिले", value: agg.totalBills },
    { label: "एकूण वजन (KG)", value: fmt(agg.totalWeight) },
    { label: "एकूण विक्री (₹)", value: fmt(agg.totalSales) },
    { label: "एकूण मजुरी (₹)", value: fmt(agg.totalLabour) },
    { label: "एकूण देणे रक्कम (₹)", value: fmt(agg.totalPayable) },
  ];
  document.getElementById("statGrid").innerHTML = stats
    .map(
      (s) => `<div class="stat-card"><div class="stat-value">${s.value}</div><div class="stat-label">${s.label}</div></div>`
    )
    .join("");
}

function renderTable(id, rows, headers) {
  const el = document.getElementById(id);
  if (!rows.length) {
    el.innerHTML = `<div class="empty-state">डेटा उपलब्ध नाही.</div>`;
    return;
  }
  el.innerHTML = `
    <table class="mini-table">
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const bills = await window.BFSStorage.getBills();
  const agg = computeAggregates(bills);

  renderStatCards(agg);

  renderTable(
    "monthTable",
    Object.entries(agg.byMonth)
      .sort()
      .map(([k, v]) => [k, `₹${fmt(v)}`]),
    ["महिना (MM/YYYY)", "विक्री"]
  );

  renderTable(
    "productTable",
    Object.entries(agg.byProduct)
      .sort((a, b) => b[1].sales - a[1].sales)
      .map(([k, v]) => [k, `${fmt(v.qty)} KG`, `₹${fmt(v.sales)}`]),
    ["माल", "एकूण वजन", "एकूण विक्री"]
  );

  renderTable(
    "customerTable",
    Object.entries(agg.byCustomer)
      .sort((a, b) => b[1].sales - a[1].sales)
      .slice(0, 20)
      .map(([k, v]) => [k, v.bills, `₹${fmt(v.sales)}`]),
    ["ग्राहक", "बिले", "एकूण विक्री"]
  );

  renderTable(
    "dateTable",
    Object.entries(agg.byDate)
      .sort((a, b) => new Date(b[0].split("/").reverse().join("-")) - new Date(a[0].split("/").reverse().join("-")))
      .map(([k, v]) => [k, `₹${fmt(v)}`]),
    ["दिनांक", "विक्री"]
  );
});
