// Server-only helpers for tasks. Brevo email for assignment + reminder.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/brevo";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function brevoSend(opts: {
  to: string;
  toName: string;
  subject: string;
  html: string;
}) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const brevoKey = process.env.BREVO_API_KEY;
  if (!lovableKey || !brevoKey) {
    console.warn("[tasks] Brevo not configured; skipping email");
    return;
  }
  const fromEmail = process.env.BREVO_FROM_EMAIL || "no-reply@dialingfordollars.co";
  const fromName = process.env.BREVO_FROM_NAME || "Dialing for Dollars";

  const res = await fetch(`${GATEWAY_URL}/smtp/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": brevoKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: opts.to, name: opts.toName }],
      subject: opts.subject,
      htmlContent: opts.html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${txt.slice(0, 200)}`);
  }
}

function appLink(path: string) {
  const base = process.env.APP_BASE_URL || "https://leads.dialingfordollars.co";
  return `${base}${path}`;
}

export async function sendTaskAssignedEmail(opts: {
  to: string;
  toName: string;
  title: string;
  notes: string | null;
  dueAt: string | null;
  contactName: string;
  contactId: string;
}) {
  const link = appLink(`/contacts/${opts.contactId}`);
  const due = opts.dueAt ? new Date(opts.dueAt).toLocaleString() : "No due date";
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px">
      <h2 style="margin:0 0 12px">New task assigned to you</h2>
      <p style="color:#444;margin:0 0 16px">${escapeHtml(opts.toName)}, a new task has been assigned to you on a lead.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="font-weight:600;font-size:15px;margin-bottom:6px">${escapeHtml(opts.title)}</div>
        <div style="color:#555;font-size:13px;margin-bottom:4px"><strong>Lead:</strong> ${escapeHtml(opts.contactName)}</div>
        <div style="color:#555;font-size:13px;margin-bottom:4px"><strong>Due:</strong> ${escapeHtml(due)}</div>
        ${opts.notes ? `<div style="color:#444;font-size:13px;margin-top:8px;white-space:pre-wrap">${escapeHtml(opts.notes)}</div>` : ""}
      </div>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open lead</a>
    </div>
  `;
  await brevoSend({
    to: opts.to,
    toName: opts.toName,
    subject: `New task: ${opts.title}`,
    html,
  });
}

export async function sendTaskReminderEmail(opts: {
  to: string;
  toName: string;
  title: string;
  notes: string | null;
  dueAt: string;
  contactName: string;
  contactId: string;
}) {
  const link = appLink(`/contacts/${opts.contactId}`);
  const due = new Date(opts.dueAt).toLocaleString();
  const html = `
    <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px">
      <h2 style="margin:0 0 12px">Reminder: task is due soon</h2>
      <p style="color:#444;margin:0 0 16px">${escapeHtml(opts.toName)}, this task is coming up.</p>
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:16px">
        <div style="font-weight:600;font-size:15px;margin-bottom:6px">${escapeHtml(opts.title)}</div>
        <div style="color:#555;font-size:13px;margin-bottom:4px"><strong>Lead:</strong> ${escapeHtml(opts.contactName)}</div>
        <div style="color:#555;font-size:13px;margin-bottom:4px"><strong>Due:</strong> ${escapeHtml(due)}</div>
        ${opts.notes ? `<div style="color:#444;font-size:13px;margin-top:8px;white-space:pre-wrap">${escapeHtml(opts.notes)}</div>` : ""}
      </div>
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">Open lead</a>
    </div>
  `;
  await brevoSend({
    to: opts.to,
    toName: opts.toName,
    subject: `Reminder: ${opts.title}`,
    html,
  });
}
