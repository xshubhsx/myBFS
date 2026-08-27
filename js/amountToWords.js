/**
 * amountToWords.js
 * Converts a whole rupee amount into Marathi words using the
 * Indian numbering system (कोटी / लाख / हजार / शंभर).
 */

const MARATHI_ONES = [
  "", "एक", "दोन", "तीन", "चार", "पाच", "सहा", "सात", "आठ", "नऊ",
  "दहा", "अकरा", "बारा", "तेरा", "चौदा", "पंधरा", "सोळा", "सतरा", "अठरा", "एकोणीस",
  "वीस", "एकवीस", "बावीस", "तेवीस", "चोवीस", "पंचवीस", "सव्वीस", "सत्तावीस", "अठ्ठावीस", "एकोणतीस",
  "तीस", "एकतीस", "बत्तीस", "तेहतीस", "चौतीस", "पस्तीस", "छत्तीस", "सदतीस", "अडतीस", "एकोणचाळीस",
  "चाळीस", "एकेचाळीस", "बेचाळीस", "त्रेचाळीस", "चव्वेचाळीस", "पंचेचाळीस", "सेहेचाळीस", "सत्तेचाळीस", "अठ्ठेचाळीस", "एकोणपन्नास",
  "पन्नास", "एक्कावन्न", "बावन्न", "त्रेपन्न", "चोपन्न", "पंचावन्न", "छप्पन्न", "सत्तावन्न", "अठ्ठावन्न", "एकोणसाठ",
  "साठ", "एकसष्ट", "बासष्ट", "त्रेसष्ट", "चौसष्ट", "पासष्ट", "सहासष्ट", "सदुसष्ट", "अडुसष्ट", "एकोणसत्तर",
  "सत्तर", "एकाहत्तर", "बहात्तर", "त्र्याहत्तर", "चौर्‍याहत्तर", "पंच्याहत्तर", "शहात्तर", "सत्याहत्तर", "अठ्ठ्याहत्तर", "एकोणऐंशी",
  "ऐंशी", "एक्क्याऐंशी", "ब्याऐंशी", "त्र्याऐंशी", "चौऱ्याऐंशी", "पंच्याऐंशी", "श्याऐंशी", "सत्त्याऐंशी", "अठ्ठ्याऐंशी", "एकोणनव्वद",
  "नव्वद", "एक्याण्णव", "ब्याण्णव", "त्र्याण्णव", "चौऱ्याण्णव", "पंच्याण्णव", "शहाण्णव", "सत्त्याण्णव", "अठ्ठ्याण्णव", "नव्याण्णव"
];

function twoDigitToWords(n) {
  if (n === 0) return "";
  return MARATHI_ONES[n];
}

/**
 * Converts a non-negative integer < 1,000,000,000,000 to Marathi words
 * using the Indian numbering system.
 */
function numberToMarathiWords(num) {
  num = Math.floor(Math.abs(num));
  if (num === 0) return "शून्य";

  const parts = [];

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = Math.floor(num / 100);
  num %= 100;
  const rest = num;

  if (crore > 0) parts.push(`${twoDigitToWords(crore % 100) || MARATHI_ONES[crore]} कोटी`);
  if (lakh > 0) parts.push(`${twoDigitToWords(lakh)} लाख`);
  if (thousand > 0) parts.push(`${twoDigitToWords(thousand)} हजार`);
  if (hundred > 0) parts.push(hundred === 1 ? "शंभर" : `${MARATHI_ONES[hundred]}शे`);
  if (rest > 0) parts.push(twoDigitToWords(rest));

  return parts.join(" ");
}

/**
 * Public entry point: formats a rupee amount as
 * "अक्षरी रुपये: <words> रुपये फक्त"
 */
function amountInMarathiWords(amount) {
  const rupees = Math.round(Number(amount) || 0);
  if (rupees <= 0) return "";
  return `${numberToMarathiWords(rupees)} रुपये फक्त`;
}

// expose for non-module <script> usage
window.amountInMarathiWords = amountInMarathiWords;
