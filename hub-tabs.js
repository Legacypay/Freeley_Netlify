/**
 * hub-tabs.js — Dynamic data loading for Medical Records and Billing tabs
 * Loaded by hub.html, calls getEncounterDetails and getBillingHistory APIs
 */
(function() {
  'use strict';

  var recordsLoaded = false;
  var billingLoaded = false;

  // Medical Records: load encounter details from MDI
  window.loadMedicalRecords = async function() {
    if (recordsLoaded) return;
    recordsLoaded = true;

    var loadingEl = document.getElementById('records-loading');
    var contentEl = document.getElementById('records-content');
    var emptyEl = document.getElementById('records-empty');
    if (!loadingEl) return;

    try {
      var caseId = sessionStorage.getItem('freeley_case_id');
      var patientId = sessionStorage.getItem('freeley_patient_id');
      if (!caseId) {
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
        return;
      }

      var authToken = typeof getFirebaseIdToken === 'function' ? await getFirebaseIdToken() : null;
      var headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

      var res = await fetch('/.netlify/functions/getEncounterDetails', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ case_id: caseId, patient_id: patientId })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var records = data.records || [];

      loadingEl.style.display = 'none';

      if (records.length === 0) {
        emptyEl.style.display = 'block';
        return;
      }

      var html = '';
      for (var i = 0; i < records.length; i++) {
        var rec = records[i];
        var dateStr = '';
        if (rec.date) {
          var d = new Date(rec.date);
          dateStr = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
        var icon = 'ri-file-text-line';
        if (rec.type === 'prescription') icon = 'ri-capsule-line';
        else if (rec.type === 'clinician_assignment') icon = 'ri-user-heart-line';
        else if (rec.type === 'status_update') icon = 'ri-checkbox-circle-line';

        var borderColor = 'var(--border)';
        if (rec.type === 'prescription') borderColor = 'var(--green)';
        else if (rec.type === 'clinician_assignment') borderColor = 'var(--accent)';

        html += '<div class="doc-msg" style="border-left-color:' + borderColor + ';">';
        html += '<div class="doc-meta">';
        html += '<div class="doc-avatar" style="background:var(--border-light);color:var(--text-muted);display:flex;align-items:center;justify-content:center;">';
        html += '<i class="' + icon + '"></i></div>';
        html += '<div><div class="doc-name">' + (rec.title || 'Record') + '</div>';
        if (dateStr) html += '<div class="doc-date">' + dateStr + '</div>';
        html += '</div></div>';
        if (rec.body) html += '<div class="doc-body">' + rec.body + '</div>';
        if (rec.status) {
          html += '<div style="margin-top:8px;"><span style="font-size:12px;padding:3px 10px;border-radius:20px;background:#e8f5e9;color:#2e7d32;">';
          html += rec.status + '</span></div>';
        }
        if (rec.clinician) {
          html += '<div style="margin-top:8px;font-size:13px;color:var(--text-muted);">';
          html += rec.clinician.name + (rec.clinician.specialty ? ' - ' + rec.clinician.specialty : '');
          html += '</div>';
        }
        html += '</div>';
      }
      contentEl.innerHTML = html;
      contentEl.style.display = 'block';
    } catch (e) {
      console.warn('[Hub] Medical records load error:', e);
      loadingEl.style.display = 'none';
      emptyEl.style.display = 'block';
    }
  };

  // Billing: load payment history from Stripe
  window.loadBillingHistory = async function() {
    if (billingLoaded) return;
    billingLoaded = true;

    var loadingEl = document.getElementById('billing-loading');
    var methodsEl = document.getElementById('payment-methods-content');
    var methodsEmpty = document.getElementById('payment-methods-empty');
    var invoicesEl = document.getElementById('invoices-content');
    var invoicesEmpty = document.getElementById('invoices-empty');
    if (!loadingEl) return;

    try {
      var email = sessionStorage.getItem('freeley_patient_email');
      if (!email) {
        var emailEl = document.getElementById('dashUserEmail');
        if (emailEl) email = emailEl.innerText;
      }

      var authToken = typeof getFirebaseIdToken === 'function' ? await getFirebaseIdToken() : null;
      var headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = 'Bearer ' + authToken;

      var res = await fetch('/.netlify/functions/getBillingHistory', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: email })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      loadingEl.style.display = 'none';

      var methods = data.payment_methods || [];
      if (methods.length === 0) {
        methodsEmpty.style.display = 'block';
      } else {
        var mhtml = '';
        for (var i = 0; i < methods.length; i++) {
          var pm = methods[i];
          var brand = (pm.brand || 'card');
          brand = brand.charAt(0).toUpperCase() + brand.slice(1);
          var brandIcon = 'ri-bank-card-line';
          if (pm.brand === 'visa') brandIcon = 'ri-visa-line';
          else if (pm.brand === 'mastercard') brandIcon = 'ri-mastercard-line';
          mhtml += '<div style="display:flex;align-items:center;gap:16px;padding:16px;border:1px solid var(--border);border-radius:12px;margin-bottom:8px;">';
          mhtml += '<i class="' + brandIcon + '" style="font-size:28px;color:#1a1f71;"></i>';
          mhtml += '<div style="flex:1;"><div style="font-weight:600;font-size:15px;">' + brand + ' ending in ' + pm.last4 + '</div>';
          mhtml += '<div style="font-size:13px;color:var(--text-faint);">Expires ' + pm.exp_month + '/' + pm.exp_year;
          if (pm.is_default) mhtml += ' - Default';
          mhtml += '</div></div></div>';
        }
        methodsEl.innerHTML = mhtml;
        methodsEl.style.display = 'block';
      }

      var charges = data.charges || [];
      if (charges.length === 0) {
        invoicesEmpty.style.display = 'block';
      } else {
        var ihtml = '<table style="width:100%;font-size:14px;text-align:left;border-collapse:collapse;">';
        ihtml += '<tr style="border-bottom:2px solid var(--border-light);">';
        ihtml += '<th style="padding:12px 0;">Date</th><th style="padding:12px 0;">Description</th>';
        ihtml += '<th style="padding:12px 0;">Amount</th><th style="padding:12px 0;">Receipt</th></tr>';
        for (var j = 0; j < charges.length; j++) {
          var ch = charges[j];
          var chDate = new Date(ch.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          ihtml += '<tr style="border-bottom:1px solid var(--border-light);">';
          ihtml += '<td style="padding:14px 0;color:var(--text-muted);">' + chDate + '</td>';
          ihtml += '<td style="padding:14px 0;font-weight:500;">' + (ch.description || 'Freeley Health') + '</td>';
          ihtml += '<td style="padding:14px 0;">$' + ch.amount.toFixed(2) + '</td>';
          ihtml += '<td style="padding:14px 0;">';
          if (ch.receipt_url) {
            ihtml += '<a href="' + ch.receipt_url + '" target="_blank" rel="noopener" style="color:var(--green);">';
            ihtml += '<i class="ri-download-2-line"></i> PDF</a>';
          } else {
            ihtml += '-';
          }
          ihtml += '</td></tr>';
        }
        ihtml += '</table>';
        invoicesEl.innerHTML = ihtml;
        invoicesEl.style.display = 'block';
      }
    } catch (e) {
      console.warn('[Hub] Billing load error:', e);
      loadingEl.style.display = 'none';
      if (methodsEmpty) methodsEmpty.style.display = 'block';
      if (invoicesEmpty) invoicesEmpty.style.display = 'block';
    }
  };

  // Hook into tab switches
  document.addEventListener('click', function(e) {
    var tab = e.target.closest('[onclick*="switchPanel"]');
    if (tab) {
      var onclick = tab.getAttribute('onclick') || '';
      if (onclick.indexOf("'records'") !== -1) setTimeout(window.loadMedicalRecords, 300);
      if (onclick.indexOf("'billing'") !== -1) setTimeout(window.loadBillingHistory, 300);
    }
  });

})();
