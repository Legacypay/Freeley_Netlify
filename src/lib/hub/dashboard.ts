// Overview / Treatments / Records / Billing panel data-loading logic (was
// inline in hub.astro's big script, plus the old public/hub-tabs.js).
import { setText, escapeHtml } from './dom';
import { PRODUCT_NAMES, PRODUCT_IMG } from './products';
import { getCases, getCaseStatus, getOrders, getMessages, getEncounterDetails, getBillingHistory } from './api';

// Card brand -> logo, keyed by the brand string lowercased with non-letters
// stripped so both gateways' casing matches: Authorize.Net's accountType is
// "Visa"/"MasterCard"/"AmericanExpress"/"Discover" (create-authnet-transaction.js),
// Stripe's card.brand is "visa"/"mastercard"/"amex"/"discover" (getBillingHistory.js's
// legacy fallback). Same files checkout.astro's "we accept" strip uses.
const CARD_BRAND_ICON: Record<string, string> = {
  visa: '/assets/payment/visa.svg',
  mastercard: '/assets/payment/mastercard.svg',
  amex: '/assets/payment/amex.svg',
  americanexpress: '/assets/payment/amex.svg',
  discover: '/assets/payment/discover.svg',
};

export async function refreshCaseStatus(): Promise<void> {
  const patientId = sessionStorage.getItem('freeley_patient_id');
  const caseId = sessionStorage.getItem('freeley_case_id');
  const product = sessionStorage.getItem('freeley_product');
  const voucherId = sessionStorage.getItem('freeley_voucher_id');
  const statusCard = document.getElementById('mdi-status-card');
  const noCase = document.getElementById('mdi-no-case');

  if (!patientId && !voucherId) {
    if (statusCard) statusCard.style.display = 'none';
    if (noCase) noCase.style.display = 'block';
    return;
  }

  try {
    const reqBody: Record<string, string> = {};
    if (patientId) reqBody.patient_id = patientId;
    if (caseId) reqBody.case_id = caseId;
    if (voucherId) reqBody.voucher_id = voucherId;

    const res = await getCaseStatus(reqBody);
    const data = await res.json();
    if (!res.ok) {
      if (statusCard) statusCard.style.display = 'none';
      if (noCase) noCase.style.display = 'block';
      return;
    }

    if (data.case_id && !caseId) sessionStorage.setItem('freeley_case_id', data.case_id);
    if (data.patient_id && !patientId) sessionStorage.setItem('freeley_patient_id', data.patient_id);
    if (data.patient_email) sessionStorage.setItem('freeley_patient_email', data.patient_email);

    if (statusCard) statusCard.style.display = 'block';
    if (noCase) noCase.style.display = 'none';
    setText('mdi-status-product', PRODUCT_NAMES[product || ''] || product || 'Your Treatment');
    setText('mdi-case-id-badge', data.case_id ? 'Case: ' + data.case_id.slice(0, 8) + '...' : 'Submitted');
    setText('mdi-status-icon', data.icon || '📋');
    setText('mdi-status-title', data.title || 'Status Unknown');
    setText('mdi-status-message', data.message || '');

    if (data.last_updated) {
      const d = new Date(data.last_updated);
      setText(
        'mdi-last-updated',
        'Updated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      );
    }

    if (data.clinician && data.clinician.name) {
      const sec = document.getElementById('mdi-clinician-section');
      if (sec) sec.style.display = 'flex';
      setText('mdi-clinician-name', data.clinician.name);
      setText('mdi-clinician-specialty', data.clinician.specialty || 'Physician');
      if (data.clinician.photo) {
        const img = document.getElementById('mdi-clinician-photo') as HTMLImageElement | null;
        if (img) {
          img.src = data.clinician.photo;
          img.style.display = 'block';
        }
      }
    }

    updateOverviewFromCaseStatus(data, product);
  } catch (e) {
    console.warn('[Hub] caseStatus call failed:', e);
    setText('mdi-status-message', 'Unable to load status. Please try again.');
  }
}

function updateOverviewFromCaseStatus(data: any, product: string | null): void {
  if (!data) return;
  setText('overview-product-name', PRODUCT_NAMES[product || ''] || product || 'Your Treatment');
  setText('overview-product-desc', data.title || 'Under Review');
  setText('overview-updated', data.message || '');
  setText('overview-status-badge', data.title || 'Active');
}

// Orders & Shipment card, sibling of the case-status card above and driven
// by the same sessionStorage identifiers. An empty `orders` array is a normal
// state (voucher not redeemed / nothing shipped yet), not an error — it shows
// the empty state, same as a failed request.
export async function refreshOrders(): Promise<void> {
  const patientId = sessionStorage.getItem('freeley_patient_id');
  const caseId = sessionStorage.getItem('freeley_case_id');
  const voucherId = sessionStorage.getItem('freeley_voucher_id');
  const orderCard = document.getElementById('mdi-order-card');
  const orderList = document.getElementById('mdi-order-list');
  const orderEmpty = document.getElementById('mdi-order-empty');
  const orderUpdated = document.getElementById('mdi-order-updated');

  if (!patientId && !voucherId) {
    if (orderCard) orderCard.style.display = 'none';
    if (orderEmpty) orderEmpty.style.display = 'block';
    return;
  }

  try {
    const reqBody: Record<string, string> = {};
    if (patientId) reqBody.patient_id = patientId;
    if (caseId) reqBody.case_id = caseId;
    if (voucherId) reqBody.voucher_id = voucherId;

    const res = await getOrders(reqBody);
    const data = await res.json();
    // A 401 here means the Supabase session went stale — same fallback as a
    // missing case in refreshCaseStatus(): drop back to the empty state.
    if (!res.ok) {
      if (orderCard) orderCard.style.display = 'none';
      if (orderEmpty) orderEmpty.style.display = 'block';
      return;
    }

    const orders = Array.isArray(data.orders) ? data.orders : [];
    if (!data.has_orders || !orders.length) {
      if (orderCard) orderCard.style.display = 'none';
      if (orderEmpty) orderEmpty.style.display = 'block';
      return;
    }

    let html = '';
    orders.forEach((order: any) => {
      const statusRaw = order.status || '';
      // getOrders normalises MDI's open-string status to a fixed set:
      // pending|received|processing|ready|shipped|delivered|cancelled|failed.
      // Everything not called out here keeps the neutral in-progress badge.
      const statusClass =
        statusRaw === 'shipped' || statusRaw === 'delivered'
          ? ' hub-badge--ok'
          : statusRaw === 'cancelled' || statusRaw === 'failed'
            ? ' hub-badge--bad'
            : '';
      const statusLabel = statusRaw.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

      html += '<div class="hub-order">';
      html += '<div class="hub-order__row"><div class="hub-order__icon">' + escapeHtml(order.icon || '📦') + '</div>';
      html += '<div><div class="hub-order__title">' + escapeHtml(order.title || 'Order Update') + '</div>';
      html +=
        '<div class="hub-order__number">' +
        escapeHtml(order.order_number ? 'Order ' + order.order_number : 'Order') +
        '</div></div>';
      if (statusLabel)
        html += '<span class="hub-badge hub-order__badge' + statusClass + '">' + escapeHtml(statusLabel) + '</span>';
      html += '</div>';

      if (order.message) html += '<div class="hub-order__msg">' + escapeHtml(order.message) + '</div>';

      const products = Array.isArray(order.products) ? order.products : [];
      if (products.length) {
        html += '<div class="hub-order__products">';
        products.forEach((p: any) => {
          // The order's own product name is already a display name from MDI,
          // not one of PRODUCT_NAMES' internal keys, so it renders as-is.
          html +=
            '<div class="hub-order__product"><img src="' +
            escapeHtml(p.image_url || '/assets/brand/semag_transparent.png') +
            '" alt="" loading="lazy" decoding="async" /><span>' +
            escapeHtml(p.name || 'Treatment') +
            (Number(p.amount) > 1 ? ' &times;' + escapeHtml(String(p.amount)) : '') +
            '</span></div>';
        });
        html += '</div>';
      }

      const tracking = order.tracking;
      if (tracking && (tracking.number || tracking.link)) {
        html += '<div class="hub-order__tracking">';
        if (tracking.number)
          html +=
            '<span class="hub-order__carrier">' +
            escapeHtml((tracking.company ? tracking.company + ' ' : '') + tracking.number) +
            '</span>';
        if (tracking.link)
          html +=
            '<a class="hub-btn hub-btn--outline hub-btn--sm" href="' +
            escapeHtml(tracking.link) +
            '" target="_blank" rel="noopener noreferrer"><span class="hub-btn__ic"><i class="ri-truck-line" aria-hidden="true"></i></span> Track package</a>';
        html += '</div>';
      }

      const orderedAt = order.ordered_at || order.updated_at;
      if (orderedAt) {
        const d = new Date(orderedAt);
        html +=
          '<div class="hub-order__meta">Ordered ' +
          d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
          (order.total_amount != null ? ' - $' + Number(order.total_amount).toFixed(2) : '') +
          '</div>';
      }

      html += '</div>';
    });

    if (orderList) orderList.innerHTML = html;
    if (orderCard) orderCard.style.display = 'block';
    if (orderEmpty) orderEmpty.style.display = 'none';

    if (orderUpdated) {
      if (data.last_updated) {
        const d = new Date(data.last_updated);
        orderUpdated.textContent =
          'Updated ' + d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        orderUpdated.style.display = 'block';
      } else {
        orderUpdated.style.display = 'none';
      }
    }
  } catch (e) {
    console.warn('[Hub] getOrders call failed:', e);
    if (orderCard) orderCard.style.display = 'none';
    if (orderEmpty) orderEmpty.style.display = 'block';
  }
}

export async function loadLatestProviderMessage(): Promise<void> {
  const patientId = sessionStorage.getItem('freeley_patient_id');
  if (!patientId) return;
  try {
    const res = await getMessages({ patient_id: patientId, channel: 'patient', page: 1, per_page: 10, order: 'desc' });
    if (!res.ok) return;
    const data = await res.json();
    const messages = Array.isArray(data) ? data : data.data || data.messages || [];
    const latest = messages.find((m: any) => {
      const st = (m.sender_type || m.sender || '').toLowerCase();
      return st !== 'patient' && st !== 'user';
    });
    const container = document.getElementById('latestMessageContent');
    if (!container || !latest) return;

    const senderName = latest.sender_name || latest.user_name || latest.clinician_name || 'Your Care Team';
    const text = latest.text || latest.body || latest.content || latest.message || '';
    let timeStr = '';
    if (latest.created_at || latest.timestamp) {
      const d = new Date(latest.created_at || latest.timestamp);
      timeStr =
        d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) +
        ' at ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    container.innerHTML =
      '<div class="hub-msg__meta"><div class="hub-msg__avatar"><i class="ri-stethoscope-line"></i></div><div><div class="hub-msg__name">' +
      escapeHtml(senderName) +
      '</div>' +
      (timeStr ? '<div class="hub-msg__date">' + timeStr + '</div>' : '') +
      '</div></div><div class="hub-msg__body">' +
      escapeHtml(text.length > 300 ? text.slice(0, 300) + '...' : text) +
      '</div>';
  } catch (e) {
    console.warn('[Hub] Could not load latest provider message:', e);
  }
}

export async function loadOverviewCases(): Promise<void> {
  const loadingEl = document.getElementById('overview-loading');
  const hasCaseEl = document.getElementById('overview-has-case');
  const noCaseEl = document.getElementById('overview-no-case');
  if (!loadingEl || !hasCaseEl || !noCaseEl) return;
  loadingEl.style.display = 'block';
  hasCaseEl.style.display = 'none';
  noCaseEl.style.display = 'none';

  try {
    const emailEl = document.getElementById('dashUserEmail');
    const email = emailEl ? (emailEl as HTMLElement).innerText : '';
    if (!email) {
      noCaseEl.style.display = 'block';
      loadingEl.style.display = 'none';
      return;
    }

    const res = await getCases(email);
    if (!res.ok) throw new Error('patientCases ' + res.status);
    const data = await res.json();
    const cases = data.cases || data.data || [];
    if (!cases.length) {
      loadingEl.style.display = 'none';
      noCaseEl.style.display = 'block';
      return;
    }

    cases.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    const latest = cases[0];

    if (latest.patient_id) sessionStorage.setItem('freeley_patient_id', latest.patient_id);
    if (latest.patient_email) sessionStorage.setItem('freeley_patient_email', latest.patient_email);
    if (latest.case_id || latest.id) sessionStorage.setItem('freeley_case_id', latest.case_id || latest.id);
    if (latest.voucher_id) sessionStorage.setItem('freeley_voucher_id', latest.voucher_id);
    if (latest.product_name) sessionStorage.setItem('freeley_product', latest.product_name);
    if (latest.product_category) sessionStorage.setItem('freeley_product_category', latest.product_category);

    const productKey = latest.product_key || latest.product || '';
    const productName = PRODUCT_NAMES[productKey] || latest.product_name || productKey || 'Your Treatment';
    const statusRaw = latest.status || latest.encounter_status || 'pending';
    const statusLabel = statusRaw.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    setText('overview-product-name', productName);
    setText('overview-product-desc', 'Status: ' + statusLabel);

    const imgEl = document.getElementById('overview-product-img') as HTMLImageElement | null;
    if (imgEl) {
      imgEl.src = PRODUCT_IMG[productKey] || '/assets/brand/semag_transparent.png';
      imgEl.alt = productName;
    }

    const badge = document.getElementById('overview-status-badge');
    if (badge) {
      badge.textContent = statusLabel;
      badge.className =
        'hub-badge' +
        (statusRaw === 'approved' || statusRaw === 'completed'
          ? ' hub-badge--ok'
          : statusRaw === 'cancelled'
            ? ' hub-badge--bad'
            : '');
    }

    const updatedAt = latest.updated_at || latest.created_at;
    setText(
      'overview-updated',
      updatedAt
        ? 'Last updated: ' + new Date(updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : 'Case submitted — awaiting physician review',
    );

    if (latest.patient_id) setText('overview-patient-id', 'Patient ID: ' + latest.patient_id);

    loadingEl.style.display = 'none';
    hasCaseEl.style.display = 'block';

    setTimeout(refreshCaseStatus, 300);
    setTimeout(loadLatestProviderMessage, 600);
  } catch (e) {
    console.warn('[Hub] loadOverviewCases error:', e);
    loadingEl.style.display = 'none';
    noCaseEl.style.display = 'block';
  }
}

export async function loadMedicalRecords(): Promise<void> {
  const loadingEl = document.getElementById('records-loading');
  const contentEl = document.getElementById('records-content');
  const emptyEl = document.getElementById('records-empty');
  if (!loadingEl || !contentEl || !emptyEl) return;
  try {
    const caseId = sessionStorage.getItem('freeley_case_id');
    const patientId = sessionStorage.getItem('freeley_patient_id');
    if (!caseId) {
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
      return;
    }

    const res = await getEncounterDetails({ case_id: caseId, patient_id: patientId });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const records = data.records || [];
    loadingEl.style.display = 'none';
    if (!records.length) {
      emptyEl.style.display = 'block';
      return;
    }

    let html = '';
    records.forEach((rec: any) => {
      const dateStr = rec.date
        ? new Date(rec.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
        : '';
      let icon = 'ri-file-text-line';
      if (rec.type === 'prescription') icon = 'ri-capsule-line';
      else if (rec.type === 'clinician_assignment') icon = 'ri-user-heart-line';
      else if (rec.type === 'status_update') icon = 'ri-checkbox-circle-line';

      html += '<div class="hub-msg"><div class="hub-msg__meta"><div class="hub-msg__avatar"><i class="' + icon + '"></i></div>';
      html += '<div><div class="hub-msg__name">' + escapeHtml(rec.title || 'Record') + '</div>';
      if (dateStr) html += '<div class="hub-msg__date">' + dateStr + '</div>';
      html += '</div></div>';
      if (rec.body) html += '<div class="hub-msg__body">' + escapeHtml(rec.body) + '</div>';
      if (rec.status)
        html += '<div style="margin-top:8px;"><span class="hub-badge hub-badge--ok">' + escapeHtml(rec.status) + '</span></div>';
      if (rec.clinician)
        html +=
          '<div style="margin-top:8px; font-size:13px; color:var(--muted);">' +
          escapeHtml(rec.clinician.name) +
          (rec.clinician.specialty ? ' - ' + escapeHtml(rec.clinician.specialty) : '') +
          '</div>';
      html += '</div>';
    });
    contentEl.innerHTML = html;
    contentEl.style.display = 'block';
  } catch (e) {
    console.warn('[Hub] Medical records load error:', e);
    loadingEl.style.display = 'none';
    emptyEl.style.display = 'block';
  }
}

export async function loadBillingHistory(): Promise<void> {
  const loadingEl = document.getElementById('billing-loading');
  const methodsEl = document.getElementById('payment-methods-content');
  const methodsEmpty = document.getElementById('payment-methods-empty');
  const invoicesEl = document.getElementById('invoices-content');
  const invoicesEmpty = document.getElementById('invoices-empty');
  if (!loadingEl) return;
  try {
    let email = sessionStorage.getItem('freeley_patient_email');
    if (!email) {
      const emailEl = document.getElementById('dashUserEmail');
      if (emailEl) email = (emailEl as HTMLElement).innerText;
    }
    const res = await getBillingHistory(email || '');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    loadingEl.style.display = 'none';

    const methods = data.payment_methods || [];
    if (!methods.length) {
      if (methodsEmpty) methodsEmpty.style.display = 'block';
    } else {
      let mhtml = '';
      methods.forEach((pm: any) => {
        let brand = pm.brand || 'card';
        brand = brand.charAt(0).toUpperCase() + brand.slice(1);
        // Same brand logos checkout.astro shows in its "we accept" strip
        // (public/assets/payment/*.svg) — here picked by the card's actual
        // brand instead of shown all together. Falls back to the generic
        // icon for brands we don't have artwork for (JCB, Diners, ...) or an
        // unrecognized string.
        const cardIcon = CARD_BRAND_ICON[(pm.brand || '').toLowerCase().replace(/[^a-z]/g, '')];
        const iconHtml = cardIcon
          ? '<div class="hub-pm__cardicon"><img src="' + cardIcon + '" alt="' + escapeHtml(brand) + '" /></div>'
          : '<i class="ri-bank-card-line"></i>';
        mhtml +=
          '<div class="hub-pm">' + iconHtml + '<div><div class="hub-pm__brand">' +
          escapeHtml(brand) +
          ' ending in ' +
          escapeHtml(String(pm.last4)) +
          '</div>';
        const exp = pm.exp_month && pm.exp_year ? 'Expires ' + pm.exp_month + '/' + pm.exp_year : 'Saved at checkout';
        mhtml += '<div class="hub-pm__exp">' + exp + (pm.is_default ? ' - Default' : '') + '</div></div></div>';
      });
      if (methodsEl) {
        methodsEl.innerHTML = mhtml;
        methodsEl.style.display = 'block';
      }
    }

    const charges = data.charges || [];
    if (!charges.length) {
      if (invoicesEmpty) invoicesEmpty.style.display = 'block';
    } else {
      let ihtml = '<table class="hub-table"><tr><th>Date</th><th>Description</th><th>Amount</th><th>Receipt</th></tr>';
      charges.forEach((ch: any) => {
        const chDate = new Date(ch.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        ihtml += '<tr><td class="hub-table__muted">' + chDate + '</td><td>' + escapeHtml(ch.description || 'Freeley Health') + '</td>';
        ihtml += '<td>$' + Number(ch.amount).toFixed(2) + '</td><td>';
        ihtml += ch.receipt_url
          ? '<a href="' + ch.receipt_url + '" target="_blank" rel="noopener" class="hub-receipt-link"><i class="ri-download-2-line"></i> PDF</a>'
          : '-';
        ihtml += '</td></tr>';
      });
      ihtml += '</table>';
      if (invoicesEl) {
        invoicesEl.innerHTML = ihtml;
        invoicesEl.style.display = 'block';
      }
    }
  } catch (e) {
    console.warn('[Hub] Billing load error:', e);
    loadingEl.style.display = 'none';
    if (methodsEmpty) methodsEmpty.style.display = 'block';
    if (invoicesEmpty) invoicesEmpty.style.display = 'block';
  }
}
