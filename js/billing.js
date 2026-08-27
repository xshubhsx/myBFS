/**
 * billing.js — main billing page behaviour
 */

let rowCounter = 0;
let isSaving = false;

const tbody = document.getElementById("itemsBody");
const labourRateInput = document.getElementById("labourRate");
const mobileInput = document.getElementById("mobileNumber");

function fmt(n) {
  const val = Number(n) || 0;
  return val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function todayDDMMYYYY() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return { dd, mm, yyyy, iso: d.toISOString().slice(0, 10) };
}

function setToday() {
  const { dd, mm, yyyy } = todayDDMMYYYY();
  document.getElementById("dateDD").value = dd;
  document.getElementById("dateMM").value = mm;
  document.getElementById("dateYYYY").value = yyyy;
}

function addRow(prefill = {}) {
  rowCounter += 1;
  const rowId = `row-${rowCounter}`;
  const tr = document.createElement("tr");
  tr.dataset.rowId = rowId;
  tr.innerHTML = `
    <td><input type="text" class="cell-input product" placeholder="उदा. आंबा" value="${prefill.productType || ""}" /></td>
    <td><input type="number" min="0" step="0.01" class="cell-input weight" value="${prefill.weight ?? ""}" /></td>
    <td class="cell-readonly kadta">0</td>
    <td class="cell-readonly totalWeight">0</td>
    <td class="cell-readonly labourCharge">0</td>
    <td><input type="number" min="0" step="0.01" class="cell-input rate" value="${prefill.rate ?? ""}" /></td>
    <td class="cell-readonly amount">0</td>
    <td class="row-actions"><button type="button" class="btn-remove-row" title="ओळ काढा">✕</button></td>
  `;
  tbody.appendChild(tr);

  // Recalculate when weight or rate changes. `kadta` is auto-calculated and read-only.
  tr.querySelectorAll(".weight, .rate").forEach((el) => {
    el.addEventListener("input", () => recalcAll());
  });
  tr.querySelector(".btn-remove-row").addEventListener("click", () => {
    if (tbody.children.length <= 1) {
      showToast("किमान एक ओळ आवश्यक आहे", "error");
      return;
    }
    if (confirm("ही ओळ काढायची आहे का?")) {
      tr.remove();
      recalcAll();
    }
  });

  recalcAll();
}

function recalcAll() {
  const labourRate = Number(labourRateInput.value) || 0;
  let grandTotal = 0;
  let totalLabour = 0;
  let totalWeightSum = 0;
  let anyInvalid = false;

  tbody.querySelectorAll("tr").forEach((tr) => {
    const weight = Number(tr.querySelector(".weight").value) || 0;
    const rate = Number(tr.querySelector(".rate").value) || 0;
    const kadtaField = tr.querySelector(".kadta");

    // automatic कडता calculation: (weight * 50) / 1000
    const kadta = (weight * 50) / 1000;

    // validation: kadta should not exceed weight (shouldn't happen for non-negative weights)
    let totalWeight = weight - kadta;
    if (kadta > weight && weight > 0) {
      kadtaField.classList.add("input-error");
      anyInvalid = true;
      totalWeight = 0;
    } else {
      kadtaField.classList.remove("input-error");
    }
    totalWeight = Math.max(0, totalWeight);

    // labour charge applies to the entered weight (वजन), not post-deduction weight
    const labourCharge = (weight / 1000) * labourRate;
    const amount = totalWeight * rate;

    // update UI (kadta is read-only)
    kadtaField.textContent = fmt(kadta);
    tr.querySelector(".totalWeight").textContent = fmt(totalWeight);
    tr.querySelector(".labourCharge").textContent = fmt(labourCharge);
    tr.querySelector(".amount").textContent = fmt(amount);

    grandTotal += amount;
    totalLabour += labourCharge;
    totalWeightSum += totalWeight;
  });

  let payable = grandTotal - totalLabour;
  const payableEl = document.getElementById("payableAmount");

  if (payable < 0) {
    payableEl.classList.add("input-error");
  } else {
    payableEl.classList.remove("input-error");
  }

  document.getElementById("totalAmount").value = fmt(grandTotal);
  document.getElementById("totalLabour").value = fmt(totalLabour);
  payableEl.value = fmt(payable);
  document.getElementById("amountWords").value = amountInMarathiWords(payable);

  document.getElementById("kadtaWarning").style.display = anyInvalid ? "block" : "none";

  return { grandTotal, totalLabour, totalWeightSum, payable, anyInvalid };
}

function collectItems() {
  const items = [];
  tbody.querySelectorAll("tr").forEach((tr) => {
    const weight = Number(tr.querySelector(".weight").value) || 0;
    // calculate kadta consistently with recalcAll
    const kadta = (weight * 50) / 1000;
    const rate = Number(tr.querySelector(".rate").value) || 0;
    const totalWeight = Math.max(0, weight - kadta);
    const labourRate = Number(labourRateInput.value) || 0;
    // labour charge recorded for storage should match UI: based on entered weight
    const labourCharge = (weight / 1000) * labourRate;
    const amount = totalWeight * rate;
    items.push({
      productType: tr.querySelector(".product").value.trim(),
      weight,
      kadta,
      totalWeight,
      labourRate,
      labourCharge,
      rate,
      amount,
    });
  });
  return items;
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.className = "toast";
  }, 4000);
}

function validateForm() {
  const farmerName = document.getElementById("farmerName").value.trim();
  const mobile = mobileInput.value.trim();
  const items = collectItems();

  if (!farmerName) return "कृपया शेतकऱ्याचे नाव भरा.";
  if (!/^[0-9]{10}$/.test(mobile)) return "कृपया वैध १० अंकी मोबाईल नं. भरा.";
  if (items.length === 0) return "किमान एक माल ओळ आवश्यक आहे.";

  for (const item of items) {
    if (!item.productType) return "प्रत्येक ओळीत मालाचा प्रकार भरा.";
    if (item.weight <= 0) return "वजन शून्यापेक्षा जास्त असावे.";
    if (item.kadta < 0) return "कडता ऋण असू शकत नाही.";
    if (item.kadta > item.weight) return "कडता वजनापेक्षा जास्त असू शकत नाही.";
    if (item.rate < 0) return "भाव ऋण असू शकत नाही.";
  }
  if ((Number(labourRateInput.value) || 0) < 0) return "लेबर दर ऋण असू शकत नाही.";
  return null;
}

function buildBillPayload() {
  const { dd, mm, yyyy } = {
    dd: document.getElementById("dateDD").value,
    mm: document.getElementById("dateMM").value,
    yyyy: document.getElementById("dateYYYY").value,
  };
  const totals = recalcAll();
  return {
    date: `${dd}/${mm}/${yyyy}`,
    farmerName: document.getElementById("farmerName").value.trim(),
    mobileNumber: mobileInput.value.trim(),
    village: document.getElementById("village").value.trim(),
    // vehicleNumber and driverName removed by spec
    items: collectItems(),
    totalWeight: totals.totalWeightSum,
    totalLabour: totals.totalLabour,
    totalAmount: totals.grandTotal,
    amountInWords: amountInMarathiWords(totals.payable),
    // vehicleCharge removed per spec
    payableAmount: totals.payable,
    imageUrl: "",
    createdBy: "local-user",
  };
}

function resetForm() {
  document.getElementById("farmerName").value = "";
  mobileInput.value = "";
  document.getElementById("village").value = "";
  labourRateInput.value = "";
  tbody.innerHTML = "";
  rowCounter = 0;
  addRow();
  setToday();
  recalcAll();
}

async function handleSubmit() {
  if (isSaving) return;
  const error = validateForm();
  if (error) {
    showToast(error, "error");
    return;
  }

  isSaving = true;
  const submitBtn = document.getElementById("submitBtn");
  submitBtn.disabled = true;
  submitBtn.textContent = "सेव्ह होत आहे...";

  try {
    const payload = buildBillPayload();
    const savedBill = await window.BFSStorage.saveBill(payload);
    showToast(`बिल यशस्वीरित्या सेव्ह झाले — Bill ID: ${savedBill.billId}`, "success");
    document.getElementById("savedBillId").textContent = savedBill.billId;
    document.getElementById("successPanel").style.display = "flex";
    window._lastSavedBillId = savedBill.billId;
  } catch (e) {
    console.error(e);
    showToast("Bill save failed. Your entered information is still सुरक्षित आहे. Please try again.", "error");
  } finally {
    isSaving = false;
    submitBtn.disabled = false;
    submitBtn.textContent = "SUBMIT BILL";
  }
}

async function saveAsImage() {
  const billEl = document.getElementById("billPaper");
  if (!window.html2canvas) {
    showToast("Image टूल लोड होत आहे, कृपया पुन्हा प्रयत्न करा.", "error");
    return;
  }
  try {
    const canvas = await window.html2canvas(billEl, { scale: 2, backgroundColor: "#ffffff" });
    const link = document.createElement("a");
    const billId = window._lastSavedBillId || "draft";
    link.download = `BFS-Bill-${billId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    showToast("बिल इमेज डाउनलोड झाली.", "success");
  } catch (e) {
    console.error(e);
    showToast("इमेज तयार करताना त्रुटी आली.", "error");
  }
}

function checkMobileForSuggestion() {
  const mobile = mobileInput.value.trim();
  if (!/^[0-9]{10}$/.test(mobile)) {
    document.getElementById("customerSuggestion").style.display = "none";
    return;
  }
  window.BFSStorage.findCustomerByMobile(mobile).then((customer) => {
    const box = document.getElementById("customerSuggestion");
    if (customer) {
      box.style.display = "block";
      box.innerHTML = `मागील माहिती: <b>${customer.name || ""}</b>, ${customer.village || ""} — भरण्यासाठी क्लिक करा`;
      box.onclick = () => {
        document.getElementById("farmerName").value = customer.name || "";
        document.getElementById("village").value = customer.village || "";
        box.style.display = "none";
      };
    } else {
      box.style.display = "none";
    }
  });
}

function updateOnlineStatus() {
  const el = document.getElementById("onlineStatus");
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = "● जोडलेले";
    el.className = "online-status online";
  } else {
    el.textContent = "● ऑफलाइन — डेटा सुरक्षित आहे";
    el.className = "online-status offline";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setToday();
  addRow();
  document.getElementById("addItemBtn").addEventListener("click", () => addRow());
  labourRateInput.addEventListener("input", recalcAll);
  // vehicleCharge input removed — payable updates when labourRate or item fields change
  mobileInput.addEventListener("blur", checkMobileForSuggestion);
  document.getElementById("submitBtn").addEventListener("click", handleSubmit);
  document.getElementById("saveImageBtn").addEventListener("click", saveAsImage);
  document.getElementById("newBillBtn").addEventListener("click", () => {
    document.getElementById("successPanel").style.display = "none";
    resetForm();
  });

  window.addEventListener("online", updateOnlineStatus);
  window.addEventListener("offline", updateOnlineStatus);
  updateOnlineStatus();
});
