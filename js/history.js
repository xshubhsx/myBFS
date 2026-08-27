/**
 * history.js — Bill History page (read-only)
 */

function fmt(n) {
  return (Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

async function renderList(bills) {
  const wrap = document.getElementById("historyList");
  if (!bills.length) {
    wrap.innerHTML = `<div class="empty-state">अजून कोणतेही बिल सेव्ह झालेले नाही.</div>`;
    return;
  }

  wrap.innerHTML = bills
    .map(
      (b) => `
    <div class="history-row" data-id="${b.billId}">
      <div class="hr-main">
        <div class="hr-id">${b.billId}</div>
        <div class="hr-name">${b.farmerName}</div>
        <div class="hr-meta">${b.date} · ${b.village || "-"} · 📞 ${b.mobileNumber}</div>
      </div>
      <div class="hr-amounts">
        <div>एकूण वजन: <b>${fmt(b.totalWeight)} KG</b></div>
        <div>एकूण रक्कम: <b>₹${fmt(b.totalAmount)}</b></div>
        <div>देणे रक्कम: <b class="hr-payable">₹${fmt(b.payableAmount)}</b></div>
      </div>
      <div class="hr-actions">
        <button class="btn btn-outline btn-sm view-btn" data-id="${b.billId}">View Bill</button>
      </div>
    </div>`
    )
    .join("");

  wrap.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => openDetails(btn.dataset.id));
  });
}

async function openDetails(billId) {
  const bill = await window.BFSStorage.getBillById(billId);
  if (!bill) return;

  const rowsHtml = bill.items
    .map(
      (it) => `
    <tr>
      <td>${it.productType}</td>
      <td>${fmt(it.weight)}</td>
      <td>${fmt(it.kadta)}</td>
      <td>${fmt(it.totalWeight)}</td>
      <td>${fmt(it.labourCharge)}</td>
      <td>${fmt(it.rate)}</td>
      <td>${fmt(it.amount)}</td>
    </tr>`
    )
    .join("");

  document.getElementById("detailsContent").innerHTML = `
    <div class="detail-header">
      <div><b>Bill ID:</b> ${bill.billId}</div>
      <div><b>दिनांक:</b> ${bill.date}</div>
    </div>
    <div class="detail-grid">
      <div><b>शेतकऱ्याचे नाव:</b> ${bill.farmerName}</div>
      <div><b>मोबाईल:</b> ${bill.mobileNumber}</div>
      <div><b>गाव:</b> ${bill.village || "-"}</div>
    </div>
    <div class="table-wrap" style="margin-top:14px;">
      <table class="bill-table">
        <thead><tr>
          <th>मालाचा प्रकार</th><th>वजन</th><th>कडता</th><th>एकूण वजन</th>
          <th>लेबर चार्ज</th><th>भाव</th><th>एकूण रक्कम</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
    <div class="detail-totals">
      <div>अक्षरी रुपये: <i>${bill.amountInWords || "-"}</i></div>
      <div>एकूण रुपये: <b>₹${fmt(bill.totalAmount)}</b></div>
      <div>मजुरी: <b>₹${fmt(bill.totalLabour)}</b></div>
      
      <div class="payable">देणे रक्कम: <b>₹${fmt(bill.payableAmount)}</b></div>
    </div>
  `;

  window._currentDetailBillId = bill.billId;
  document.getElementById("detailsModal").style.display = "flex";
}

async function doSearch(query) {
  const bills = await window.BFSStorage.searchBills(query);
  renderList(bills);
}

async function saveDetailImage() {
  const el = document.getElementById("detailsCard");
  if (!window.html2canvas) return;
  const canvas = await window.html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
  const link = document.createElement("a");
  link.download = `BFS-Bill-${window._currentDetailBillId}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

document.addEventListener("DOMContentLoaded", async () => {
  const bills = await window.BFSStorage.getBills();
  renderList(bills);

  document.getElementById("searchInput").addEventListener("input", (e) => {
    doSearch(e.target.value);
  });

  document.getElementById("closeModal").addEventListener("click", () => {
    document.getElementById("detailsModal").style.display = "none";
  });
  document.getElementById("detailsModal").addEventListener("click", (e) => {
    if (e.target.id === "detailsModal") e.target.style.display = "none";
  });
  document.getElementById("saveDetailImageBtn").addEventListener("click", saveDetailImage);
});
