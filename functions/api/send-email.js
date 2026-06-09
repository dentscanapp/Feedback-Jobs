export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const body = await request.json();

    const { name, email, phone, role, message } = body;

    // Az API kulcsot a Cloudflare Dashboardon Environment Variable-ként kell beállítani:
    //   Settings > Variables and Secrets > RESEND_API_KEY (Secret típus)
    const resendApiKey = env.RESEND_API_KEY;
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY nincs beállítva' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: 'contact@feedbackjobs.com',
        reply_to: email,
        subject: `[Feedback Jobs] Új ${role === 'employer' ? 'munkaadó' : 'munkakereső'} érdeklődés: ${name}`,
        html: htmlContent
      })
    });

    if (!resRequest.ok) {
      const errorData = await resRequest.json();
      return new Response(JSON.stringify({ error: errorData }), { 
        status: resRequest.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await resRequest.json();
    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
