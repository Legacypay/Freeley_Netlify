// Secure messaging chat widget (2FA verify -> code -> chat). Was the
// "in-app chat" section of hub.astro's big inline script.
import { escapeHtml } from './dom';
import { getMessages, sendMessage, requestMessagingCode, validateMessagingCode } from './api';

const chatOverlay = document.getElementById('chatOverlay');
const chatBody = document.getElementById('chatBody');
const chatFooter = document.getElementById('chatFooter');
let chatIsOpen = false;
let chatPollingTimer: ReturnType<typeof setInterval> | null = null;

function getPatientEmail(): string {
  const emailEl = document.getElementById('dashUserEmail');
  return sessionStorage.getItem('freeley_patient_email') || (emailEl ? emailEl.textContent || '' : '') || '';
}

/** Opens the chat drawer. Called by HubOverviewPanel's "Message Care Team"
 * buttons via a direct import — no global, no event, just an export. */
export function openMessaging(): void {
  const patientId = sessionStorage.getItem('freeley_patient_id');
  if (!patientId) {
    alert('Please complete your intake first. No active patient record found.');
    return;
  }
  if (!chatOverlay || !chatBody || !chatFooter) return;
  chatOverlay.classList.add('is-open');
  chatIsOpen = true;
  document.body.style.overflow = 'hidden';

  const clinName = document.getElementById('mdi-clinician-name');
  if (clinName && clinName.textContent) {
    const el = document.getElementById('chatHeaderName');
    if (el) el.textContent = clinName.textContent;
  }
  const clinSpecialty = document.getElementById('mdi-clinician-specialty');
  if (clinSpecialty && clinSpecialty.textContent) {
    const el = document.getElementById('chatHeaderRole');
    if (el) el.textContent = clinSpecialty.textContent;
  }
  const clinPhoto = document.getElementById('mdi-clinician-photo') as HTMLImageElement | null;
  if (clinPhoto && clinPhoto.src && !clinPhoto.src.endsWith('/')) {
    const avatarImg = document.getElementById('chatAvatarImg') as HTMLImageElement | null;
    const avatarFallback = document.getElementById('chatAvatarFallback');
    if (avatarImg) {
      avatarImg.src = clinPhoto.src;
      avatarImg.style.display = 'block';
    }
    if (avatarFallback) avatarFallback.style.display = 'none';
  }

  showChatUI();
  loadMessages();
  chatPollingTimer = setInterval(() => {
    if (chatIsOpen) loadMessages(true);
  }, 15000);
}

function showChatUI(): void {
  if (!chatFooter || !chatBody) return;
  chatFooter.style.display = 'flex';
  chatBody.innerHTML = '<div class="hub-chat-loading"><i class="ri-loader-4-line"></i> Loading messages...</div>';
}

function showVerificationScreen(): void {
  if (!chatFooter || !chatBody) return;
  chatFooter.style.display = 'none';
  const email = getPatientEmail();
  const masked = email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'your email';
  chatBody.innerHTML =
    '<div class="hub-chat-verify"><i class="ri-shield-check-line"></i><h3>Secure Messaging</h3>' +
    '<p>To protect your privacy, we need to verify your identity before you can message your care team.</p>' +
    '<p style="font-size:12px;">We\'ll send a one-time code to <strong>' + escapeHtml(masked) + '</strong></p>' +
    '<button type="button" class="hub-btn hub-btn--sm" id="chatSendCodeBtn">Send Verification Code</button>' +
    '<p id="chatVerifyError" class="hub-chat-verify-error" style="display:none;"></p></div>';
  const btn = document.getElementById('chatSendCodeBtn');
  if (btn) btn.addEventListener('click', requestVerificationCode);
}

function showEmailInputScreen(): void {
  if (!chatFooter || !chatBody) return;
  chatFooter.style.display = 'none';
  chatBody.innerHTML =
    '<div class="hub-chat-verify"><i class="ri-mail-line"></i><h3>Enter Your Email</h3>' +
    '<p>Please enter the email address you used during your medical intake. This may be different from your login email.</p>' +
    '<input type="email" class="hub-chat-code-input" id="chatEmailInput" style="width:260px; font-size:14px; letter-spacing:0;" placeholder="your@email.com" autofocus />' +
    '<button type="button" class="hub-btn hub-btn--sm" id="chatEmailSubmitBtn">Send Code</button>' +
    '<p id="chatVerifyError" class="hub-chat-verify-error" style="display:none;"></p></div>';
  setTimeout(() => {
    const inp = document.getElementById('chatEmailInput') as HTMLInputElement | null;
    const btn = document.getElementById('chatEmailSubmitBtn');
    if (btn) btn.addEventListener('click', submitEmailAndRequestCode);
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitEmailAndRequestCode();
        }
      });
    }
  }, 100);
}

function submitEmailAndRequestCode(): void {
  const emailInput = document.getElementById('chatEmailInput') as HTMLInputElement | null;
  const manualEmail = (emailInput ? emailInput.value : '').trim();
  if (!manualEmail || manualEmail.indexOf('@') === -1) {
    showVerifyError('Please enter a valid email address.');
    return;
  }
  sessionStorage.setItem('freeley_patient_email', manualEmail);
  showVerificationScreen();
  requestVerificationCode();
}

async function requestVerificationCode(): Promise<void> {
  const email = getPatientEmail();
  const patientId = sessionStorage.getItem('freeley_patient_id');
  if (!email && !patientId) {
    showVerifyError('Unable to determine your email address. Please contact support.');
    return;
  }

  const btn = document.getElementById('chatSendCodeBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Sending...';
  }

  try {
    const payload: Record<string, string> = {};
    if (email) payload.email = email;
    if (patientId) payload.patient_id = patientId;

    const res = await requestMessagingCode(payload);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.code === 'EMAIL_MISMATCH') {
        showEmailInputScreen();
        return;
      }
      showVerifyError(
        data.code === 'PATIENT_NOT_FOUND'
          ? 'No patient account found. Please complete your intake first.'
          : data.error || 'Unable to send code. Please try again.',
      );
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Send Verification Code';
      }
      return;
    }

    const resolvedEmail = data.email || email;
    if (resolvedEmail) sessionStorage.setItem('freeley_patient_email', resolvedEmail);
    showCodeInputScreen(resolvedEmail);
  } catch (e) {
    console.error('[Chat] Request code failed:', e);
    showVerifyError('Connection error. Please try again.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Send Verification Code';
    }
  }
}

function showCodeInputScreen(email: string): void {
  if (!chatBody) return;
  const masked = email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'your email';
  chatBody.innerHTML =
    '<div class="hub-chat-verify"><i class="ri-mail-check-line"></i><h3>Enter Verification Code</h3>' +
    '<p>We sent a code to <strong>' + escapeHtml(masked) + '</strong>.<br>Check your inbox and enter it below.</p>' +
    '<input type="text" class="hub-chat-code-input" id="chatCodeInput" maxlength="8" placeholder="• • • • • •" autocomplete="one-time-code" autofocus />' +
    '<button type="button" class="hub-btn hub-btn--sm" id="chatVerifyBtn">Verify</button>' +
    '<p id="chatVerifyError" class="hub-chat-verify-error" style="display:none;"></p>' +
    '<button type="button" class="hub-chat-verify-resend" id="chatResendBtn">Didn\'t receive it? Send again</button></div>';

  setTimeout(() => {
    const inp = document.getElementById('chatCodeInput') as HTMLInputElement | null;
    const verifyBtn = document.getElementById('chatVerifyBtn');
    const resendBtn = document.getElementById('chatResendBtn');
    if (verifyBtn) verifyBtn.addEventListener('click', submitVerificationCode);
    if (resendBtn) resendBtn.addEventListener('click', requestVerificationCode);
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitVerificationCode();
        }
      });
    }
  }, 100);
}

async function submitVerificationCode(): Promise<void> {
  const codeInput = document.getElementById('chatCodeInput') as HTMLInputElement | null;
  const code = (codeInput ? codeInput.value : '').trim();
  if (!code) {
    showVerifyError('Please enter the verification code.');
    return;
  }

  const email = getPatientEmail();
  const btn = document.getElementById('chatVerifyBtn') as HTMLButtonElement | null;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Verifying...';
  }
  if (codeInput) codeInput.disabled = true;

  try {
    const res = await validateMessagingCode({ email, verification_code: code });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showVerifyError(data.error || 'Invalid code. Please try again.');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Verify';
      }
      if (codeInput) {
        codeInput.disabled = false;
        codeInput.focus();
        codeInput.select();
      }
      return;
    }

    if (data.access_token) sessionStorage.setItem('freeley_patient_token', data.access_token);
    if (data.patient_id) sessionStorage.setItem('freeley_patient_id', data.patient_id);
    if (data.email) sessionStorage.setItem('freeley_patient_email', data.email);

    showChatUI();
    loadMessages();
    chatPollingTimer = setInterval(() => {
      if (chatIsOpen) loadMessages(true);
    }, 15000);
  } catch (e) {
    console.error('[Chat] Verify code failed:', e);
    showVerifyError('Connection error. Please try again.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Verify';
    }
    if (codeInput) {
      codeInput.disabled = false;
      codeInput.focus();
    }
  }
}

function showVerifyError(msg: string): void {
  const el = document.getElementById('chatVerifyError');
  if (el) {
    el.textContent = msg;
    (el as HTMLElement).style.display = 'block';
  }
}

function closeChat(): void {
  if (!chatOverlay) return;
  chatOverlay.classList.remove('is-open');
  chatIsOpen = false;
  document.body.style.overflow = '';
  if (chatPollingTimer) {
    clearInterval(chatPollingTimer);
    chatPollingTimer = null;
  }
}

async function loadMessages(silent?: boolean): Promise<void> {
  const patientId = sessionStorage.getItem('freeley_patient_id');
  if (!patientId || !chatBody) return;
  if (!silent) chatBody.innerHTML = '<div class="hub-chat-loading"><i class="ri-loader-4-line"></i> Loading messages...</div>';
  try {
    const res = await getMessages({ patient_id: patientId, channel: 'patient', page: 1, per_page: 50, order: 'asc' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to load messages');
    }
    const data = await res.json();
    const messages = Array.isArray(data) ? data : data.data || data.messages || [];
    renderMessages(messages);
  } catch (e) {
    console.error('[Chat] Load messages failed:', e);
    if (!silent && chatBody) {
      chatBody.innerHTML =
        '<div class="hub-chat-empty"><i class="ri-chat-3-line"></i><div>Unable to load messages right now.</div><div style="font-size:11.5px;">Your care team may not have sent any messages yet, or the connection could not be established. Try again shortly.</div></div>';
    }
  }
}

function renderMessages(messages: any[]): void {
  if (!chatBody) return;
  if (!messages || !messages.length) {
    chatBody.innerHTML =
      '<div class="hub-chat-empty"><i class="ri-chat-smile-3-line"></i><div style="font-weight:700; color:var(--ink);">No messages yet</div><div>Send a message to start a conversation with your care team.</div></div>';
    return;
  }
  let html = '';
  messages.forEach((msg) => {
    const senderType = (msg.sender_type || msg.sender || '').toLowerCase();
    const isOutgoing = senderType === 'patient' || senderType === 'user';
    const cssClass = isOutgoing ? 'hub-chat-msg--out' : 'hub-chat-msg--in';
    let timeStr = '';
    if (msg.created_at || msg.timestamp) {
      const d = new Date(msg.created_at || msg.timestamp);
      timeStr =
        d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' at ' +
        d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    const senderName = !isOutgoing ? msg.sender_name || msg.user_name || msg.clinician_name || 'Care Team' : '';
    const text = msg.text || msg.body || msg.content || msg.message || '';

    html += '<div class="hub-chat-msg ' + cssClass + '">';
    if (!isOutgoing && senderName) html += '<div class="hub-chat-msg-sender">' + escapeHtml(senderName) + '</div>';
    html += '<div>' + escapeHtml(text) + '</div>';
    if (timeStr) html += '<div class="hub-chat-msg-meta">' + timeStr + '</div>';
    html += '</div>';
  });
  chatBody.innerHTML = html;
  chatBody.scrollTop = chatBody.scrollHeight;
}

async function sendChatMessage(): Promise<void> {
  const input = document.getElementById('chatInput') as HTMLTextAreaElement | null;
  if (!input || !chatBody) return;
  const text = input.value.trim();
  if (!text) return;
  const patientId = sessionStorage.getItem('freeley_patient_id');
  if (!patientId) return;

  const sendBtn = document.getElementById('chatSendBtn') as HTMLButtonElement | null;
  if (sendBtn) sendBtn.disabled = true;
  input.disabled = true;

  const emptyState = chatBody.querySelector('.hub-chat-empty');
  if (emptyState) emptyState.remove();

  const tempMsg = document.createElement('div');
  tempMsg.className = 'hub-chat-msg hub-chat-msg--out';
  tempMsg.innerHTML = '<div>' + escapeHtml(text) + '</div><div class="hub-chat-msg-meta">Sending...</div>';
  chatBody.appendChild(tempMsg);
  chatBody.scrollTop = chatBody.scrollHeight;
  input.value = '';
  autoResizeChatInput();

  try {
    const res = await sendMessage({ patient_id: patientId, text, channel: 'patient' });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to send message');
    }

    const meta = tempMsg.querySelector('.hub-chat-msg-meta');
    if (meta) {
      const now = new Date();
      meta.textContent =
        now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
        ' at ' +
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    setTimeout(() => {
      loadMessages(true);
    }, 2000);
  } catch (e) {
    console.error('[Chat] Send failed:', e);
    const meta2 = tempMsg.querySelector('.hub-chat-msg-meta') as HTMLElement | null;
    if (meta2) {
      meta2.textContent = 'Failed to send — tap to retry';
      meta2.style.color = '#c62828';
    }
    tempMsg.style.opacity = '0.7';
    tempMsg.onclick = () => {
      tempMsg.remove();
      const inp = document.getElementById('chatInput') as HTMLTextAreaElement | null;
      if (inp) inp.value = text;
      sendChatMessage();
    };
  } finally {
    if (sendBtn) sendBtn.disabled = false;
    if (input) {
      input.disabled = false;
      input.focus();
    }
  }
}

function autoResizeChatInput(): void {
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement | null;
  if (!chatInput) return;
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
}

/** Wires the widget's own static controls (close button, backdrop click,
 * send button, textarea auto-resize). Call once from HubChatWidget.astro's
 * own script. */
export function initChat(): void {
  const chatCloseBtn = document.getElementById('chatCloseBtn');
  if (chatCloseBtn) chatCloseBtn.addEventListener('click', closeChat);
  if (chatOverlay) {
    chatOverlay.addEventListener('click', (e) => {
      if (e.target === chatOverlay) closeChat();
    });
  }

  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput') as HTMLTextAreaElement | null;
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendChatMessage();
      }
    });
    chatInput.addEventListener('input', autoResizeChatInput);
  }
}
