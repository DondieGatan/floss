import crypto from 'node:crypto';

const API_BASE = 'http://localhost:5101/api';

function base32Decode(b32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of b32.toUpperCase().replace(/=+$/, '')) {
    bits += alphabet.indexOf(c).toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// Matches the server's pyotp defaults (RFC 6238: 30s step, SHA1, 6 digits)
// — see backend/app/auth/routes.py's two_factor_setup/enable routes.
export function totpCode(secretBase32, timeStep = 30, digits = 6) {
  const key = base32Decode(secretBase32);
  const counter = Math.floor(Date.now() / 1000 / timeStep);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(counter, 4);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binCode % 10 ** digits).padStart(digits, '0');
}

// Registers a brand-new patient account via the API (fast, and avoids
// polluting/depending on the shared seeded demo accounts) and returns its
// credentials plus access token for any further API setup a test needs.
export async function registerPatient(request, { emailPrefix }) {
  const email = `${emailPrefix}-${Date.now()}@example.com`;
  const password = 'password123';
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: { fullName: 'E2E Test Patient', email, password },
  });
  const body = await res.json();
  return { email, password, accessToken: body.accessToken, userId: body.user.id };
}

export async function loginAsAdmin(request) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email: 'admin@floss.demo', password: 'password123' },
  });
  const body = await res.json();
  return body.accessToken;
}

// Creates a department + doctor with availability covering every weekday
// (00:00-23:59) so a bookable slot exists no matter what day/time the
// suite actually runs — real staff-only setup done via the API instead of
// the UI, the same "API for setup, UI for the thing under test" split
// used throughout this suite.
export async function createBookableDoctor(request, adminToken) {
  const authHeaders = { Authorization: `Bearer ${adminToken}` };
  const suffix = Date.now();

  const deptRes = await request.post(`${API_BASE}/departments`, {
    headers: authHeaders,
    data: { name: `E2E Dept ${suffix}` },
  });
  const { department } = await deptRes.json();

  const doctorRes = await request.post(`${API_BASE}/doctors`, {
    headers: authHeaders,
    data: { fullName: `Dr. E2E Test ${suffix}`, departmentId: department.id, specialty: 'General' },
  });
  const { doctor } = await doctorRes.json();

  for (let weekday = 0; weekday < 7; weekday++) {
    await request.post(`${API_BASE}/doctors/${doctor.id}/availability`, {
      headers: authHeaders,
      data: { weekday, startTime: '00:00', endTime: '23:45' },
    });
  }

  return doctor;
}

export async function fillAndSubmitLogin(page, email, password) {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}
