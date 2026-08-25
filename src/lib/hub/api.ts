// One shared helper for the /.netlify/functions/* backend the hub page
// talks to, replacing ~8 duplicated fetch-with-auth-header call sites.
// Same live backend as before (netlify/functions/*); auth itself moved to
// Supabase, but the functions still verify the session's access_token
// server-side.
import { accessToken } from './auth';

async function authFetch(fn: string, body: Record<string, unknown>): Promise<Response> {
  const token = await accessToken();
  return fetch(`/.netlify/functions/${fn}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

export const getCases = (email: string) => authFetch('patientCases', { email });

export const getCaseStatus = (body: { patient_id?: string; case_id?: string; voucher_id?: string }) =>
  authFetch('caseStatus', body);

export const getOrders = (body: { patient_id?: string; case_id?: string; voucher_id?: string }) =>
  authFetch('getOrders', body);

export const getMessages = (body: {
  patient_id: string;
  channel: string;
  page: number;
  per_page: number;
  order: string;
}) => authFetch('getMessages', body);

export const sendMessage = (body: { patient_id: string; text: string; channel: string }) =>
  authFetch('sendMessage', body);

export const getBillingHistory = (email: string) => authFetch('getBillingHistory', { email });

export const getEncounterDetails = (body: { case_id: string; patient_id: string | null }) =>
  authFetch('getEncounterDetails', body);

export const requestMessagingCode = (payload: Record<string, unknown>) =>
  authFetch('requestMessagingCode', payload);

export const validateMessagingCode = (body: { email: string; verification_code: string }) =>
  authFetch('validateMessagingCode', body);
