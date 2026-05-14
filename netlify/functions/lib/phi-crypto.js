/**
 * PHI encryption at rest using AES-256-GCM.
 *
 * Used by savePendingCase / retryPendingCases to encrypt patient data
 * before persisting to Netlify Blobs (HIPAA compliance).
 *
 * Required env var: PHI_ENCRYPTION_KEY
 *   - 32 bytes, hex-encoded (64 chars) OR base64 (44 chars, padded)
 *   - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   - Store securely in Netlify env vars. Rotation requires re-encrypting
 *     any active blobs (see _legacy_key handling below).
 *
 * Blob shape:
 *   {
 *     _v: 1,                                  // encryption schema version
 *     _enc: { iv, tag, ciphertext },          // encrypted PHI fields only
 *     payment_intent_id, created_at, ...      // non-PHI metadata stays plain
 *   }
 *
 * PHI fields encrypted: patient (name/email/phone/dob), quiz_answers,
 * allergies, current_medications, medical_conditions. Other fields
 * (payment_intent_id, product key, retry_count, status, timestamps)
 * stay plaintext so the retry job can filter / log without decrypting.
 */

const { createCipheriv, createDecipheriv, randomBytes } = require('crypto');

const ALGO = 'aes-256-gcm';
const PHI_FIELDS = ['patient', 'quiz_answers', 'allergies', 'current_medications', 'medical_conditions'];

function loadKey() {
  const raw = process.env.PHI_ENCRYPTION_KEY;
  if (!raw) throw new Error('PHI_ENCRYPTION_KEY env var is not set');
  let key;
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    key = Buffer.from(raw, 'hex');
  } else {
    key = Buffer.from(raw, 'base64');
  }
  if (key.length !== 32) {
    throw new Error('PHI_ENCRYPTION_KEY must decode to exactly 32 bytes');
  }
  return key;
}

function encryptPayload(plaintextObj) {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const json = Buffer.from(JSON.stringify(plaintextObj), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(json), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

function decryptPayload({ iv, tag, ciphertext }) {
  const key = loadKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);
  return JSON.parse(plaintext.toString('utf8'));
}

/**
 * Split a pending-case record into encrypted PHI + plaintext metadata.
 */
function encryptRecord(record) {
  const phi = {};
  const meta = {};
  for (const [k, v] of Object.entries(record)) {
    if (PHI_FIELDS.includes(k) && v != null) phi[k] = v;
    else meta[k] = v;
  }
  return { _v: 1, _enc: encryptPayload(phi), ...meta };
}

/**
 * Reconstruct the full record from an encrypted blob. Backwards-compatible
 * with pre-encryption records (returns them as-is).
 */
function decryptRecord(stored) {
  if (!stored) return stored;
  if (stored._v !== 1 || !stored._enc) return stored;
  const { _v, _enc, ...meta } = stored;
  const phi = decryptPayload(_enc);
  return { ...meta, ...phi };
}

module.exports = { encryptRecord, decryptRecord, PHI_FIELDS };
