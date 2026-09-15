// Cloudflare Worker — resend.feedbackjobs.com
// Az űrlap adatait fogadja és emailt küld a Resend API-n keresztül.
//
// Beállítás a Cloudflare Dashboardon:
//   Workers & Pages > (ez a worker) > Settings > Variables and Secrets
//     Name:  RESEND_API_KEY
//     Value: re_...  (Encrypt / Secret típusként!)
//   Settings > Domains & Routes > Custom Domain: resend.feedbackjobs.com
//
// ⚠️ Ez a fájl NEM élesedik a git pushsal: a workert a Cloudflare-en kell frissíteni.

// Honnan engedjük a böngészős kéréseket (CORS).
const ALLOWED_ORIGINS = [
  'https://feedbackjobs.com',
  'https://www.feedbackjobs.com',
];

// Spam-szűrés — ugyanaz a három szabály, mint az assets/app.js-ben, szerver-oldalon is,
// mert a robot a böngésző nélkül, közvetlenül ide is küldhet.
const SPAM_MIN_MS = 3000;
const MAX_LINKS = 2;

const ROLE_LABEL = {
  employer: 'Munkaadó (Employer)',
  callback: 'Visszahívás-kérés',
  ado: 'Adóbevallás Ausztria (ajánlatkérés)',
};
const SUBJECT_LABEL = {
  employer: 'munkaadó érdeklődés',
  callback: 'visszahívás-kérés',
  ado: 'adóbevallás-ajánlatkérés',
};

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

// A mezők HTML-be kerülnek: escape nélkül bárki HTML-t/linket injektálhatna a levélbe.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Preflight kérés
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: cors });
    }

    // Böngészőből érkező kérésnél mindig van Origin; a közvetlen robot-POST-nál jellemzően nincs.
    if (!ALLOWED_ORIGINS.includes(origin)) {
      return json({ error: 'forbidden' }, 403, cors);
    }

    try {
      const body = await request.json();
      const { name, email, phone, role, message, website, t } = body;

      // Gyanús beküldés: sikert válaszolunk, de nem küldünk levelet (a robot ne tanuljon belőle).
      const links = (String(message || '').match(/https?:\/\/|www\./gi) || []).length;
      const tooFast = typeof t === 'number' && t < SPAM_MIN_MS;
      if (website || tooFast || links > MAX_LINKS) {
        return json({ success: true }, 200, cors);
      }

      const validEmail = typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || String(name).length > 200 || String(message || '').length > 5000 || (email && !validEmail)) {
        return json({ error: 'invalid' }, 400, cors);
      }

      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
        return json({ error: 'RESEND_API_KEY nincs beállítva' }, 500, cors);
      }

      const htmlContent = `
        <h2>Új kapcsolatfelvételi űrlap kitöltés</h2>
        <p><strong>Név:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> ${esc(email) || 'Nem lett megadva'}</p>
        <p><strong>Telefon:</strong> ${esc(phone) || 'Nem lett megadva'}</p>
        <p><strong>Szerepkör:</strong> ${ROLE_LABEL[role] || 'Munkakereső (Candidate)'}</p>
        <p><strong>Üzenet:</strong></p>
        <p>${message ? esc(message).replace(/\n/g, '<br>') : 'Nem lett megadva'}</p>
      `;

      const resRequest = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'onboarding@resend.dev',
          to: 'contact@feedbackjobs.com',
          ...(validEmail ? { reply_to: email } : {}),
          subject: `[Feedback Jobs] Új ${SUBJECT_LABEL[role] || 'munkakereső érdeklődés'}: ${String(name).slice(0, 80)}`,
          html: htmlContent,
        }),
      });

      if (!resRequest.ok) {
        const errorData = await resRequest.json();
        return json({ error: errorData }, resRequest.status, cors);
      }

      const data = await resRequest.json();
      return json({ success: true, data }, 200, cors);
    } catch (err) {
      return json({ error: err.message }, 500, cors);
    }
  },
};
