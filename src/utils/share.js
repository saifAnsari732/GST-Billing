// v1.10.31 — Single WhatsApp & Email URL opener used by Dashboard, ClientsView,
// InvoiceGenerator, and ReceiptVoucher.

/**
 * Sanitize a phone number for WhatsApp deep-link.
 * WhatsApp requires digits only — no +, spaces, dashes, or parens.
 * Empty / undefined → empty string (caller picks the no-phone URL).
 */
export function sanitizeWhatsAppPhone(phone) {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

/**
 * Open WhatsApp with the given phone (optional) and prefilled message.
 * Opens in a new tab so the user's current invoice / modal / draft state
 * isn't lost.
 *
 * @param {string|null|undefined} phone — recipient phone; empty → generic share
 * @param {string} message — plain text (WhatsApp caption); may include *bold*
 * @returns {Window|null} — the new tab handle, or null if blocked
 */
export function openWhatsAppShare(phone, message) {
  const clean = sanitizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message || '');
  const waUrl = clean
    ? `https://api.whatsapp.com/send?phone=${clean}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
  return window.open(waUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Sanitize an email address for mailto links.
 */
export function sanitizeEmail(email) {
  if (!email) return '';
  const clean = String(email).trim();
  return /^[^\s@?&#]+@[^\s@?&#]+$/.test(clean) ? clean : '';
}

/**
 * Open default mail client with recipient, subject, and body.
 */
export function openEmailShare(to, subject, body) {
  const cleanTo = sanitizeEmail(to);
  const encodedSubject = encodeURIComponent(subject || '');
  const encodedBody = encodeURIComponent(body || '');
  const mailtoUrl = `mailto:${cleanTo}?subject=${encodedSubject}&body=${encodedBody}`;
  return window.open(mailtoUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Build formatted message for sharing payment receipt via WhatsApp / Email.
 */
export function buildReceiptShareMessage(receipt, profile) {
  const businessName = profile?.businessName || 'Our Business';
  const amountStr = Number(receipt.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const lines = [
    `*PAYMENT RECEIPT*`,
    `Receipt No: ${receipt.receiptNo || '—'}`,
    `Date: ${receipt.date ? new Date(receipt.date).toLocaleDateString('en-IN') : '—'}`,
    `Received From: ${receipt.clientName || 'Valued Customer'}`,
    `Amount Received: ₹${amountStr}`,
    `Payment Mode: ${receipt.paymentMode || 'Cash/Bank'}${receipt.referenceNo ? ` (Ref: ${receipt.referenceNo})` : ''}`,
  ];
  if (receipt.againstInvoice) {
    lines.push(`Against Invoice: ${receipt.againstInvoice}`);
  }
  if (receipt.note) {
    lines.push(`Note: ${receipt.note}`);
  }
  lines.push('');
  lines.push(`Thank you for your business!`);
  lines.push(`— ${businessName}`);
  return lines.join('\n');
}
