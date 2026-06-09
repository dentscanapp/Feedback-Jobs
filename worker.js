// Cloudflare Worker — resend.feedbackjobs.com
// Az űrlap adatait fogadja és emailt küld a Resend API-n keresztül.
//
// Beállítás a Cloudflare Dashboardon:
//   Workers & Pages > (ez a worker) > Settings > Variables and Secrets
//     Name:  RESEND_API_KEY
//     Value: re_...  (Encrypt / Secret típusként!)
//   Settings > Domains & Routes > Custom Domain: resend.feedbackjobs.com

// Honnan engedjük a böngészős kéréseket (CORS).
const ALLOWED_ORIGINS = [
  'https://feedbackjobs.com',
  'https://www.feedbackjobs.com',
];

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
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

    try {
      const body = await request.json();
      const { name, email, phone, role, message } = body;

      const resendApiKey = env.RESEND_API_KEY;
      if (!resendApiKey) {
        return new Response(
          JSON.stringify({ error: 'RESEND_API_KEY nincs beállítva' }),
          { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const htmlContent = `
        <h2>Új kapcsolatfelvételi űrlap kitöltés</h2>
        <p><strong>Név:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone || 'Nem lett megadva'}</p>
        <p><strong>Szerepkör:</strong> ${role === 'employer' ? 'Munkaadó (Employer)' : 'Munkakereső (Candidate)'}</p>
        <p><strong>Üzenet:</strong></p>
        <p>${message ? message.replace(/\n/g, '<br>') : 'Nem lett megadva'}</p>
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
          reply_to: email,
          subject: `[Feedback Jobs] Új ${role === 'employer' ? 'munkaadó' : 'munkakereső'} érdeklődés: ${name}`,
          html: htmlContent,
        }),
      });

      if (!resRequest.ok) {
        const errorData = await resRequest.json();
        return new Response(JSON.stringify({ error: errorData }), {
          status: resRequest.status,
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }

      const data = await resRequest.json();
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }
  },
};
