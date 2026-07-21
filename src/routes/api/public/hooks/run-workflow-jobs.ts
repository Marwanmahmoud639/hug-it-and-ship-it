import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dispatchNotification } from "@/lib/notifications.server";
import { requireCronSecret } from "@/lib/cron-auth.server";

// Workflow runner — drains job_queue rows of type 'workflow_step'.
// Protected with the CRON_SECRET shared header.
export const Route = createFileRoute("/api/public/hooks/run-workflow-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronSecret(request);
        if (unauth) return unauth;
        const { data: jobs } = await supabaseAdmin.rpc("claim_jobs", {
          _job_types: ["workflow_step"],
          _limit: 25,
        } as any);
        const wfJobs = jobs ?? [];

        let processed = 0;
        for (const job of wfJobs) {
          try {
            const payload = job.payload as {
              instance_id: string;
              step_index: number;
              run_id?: string;
              override_steps?: any[];
            };
            const { data: inst } = await supabaseAdmin
              .from("workflow_instances").select("*").eq("id", payload.instance_id).single();
            if (!inst || inst.status !== "running") { await markDone(job.id); continue; }

            let steps: any[];
            if (payload.override_steps && payload.override_steps.length) {
              steps = payload.override_steps;
            } else {
              const { data: wf } = await supabaseAdmin.from("workflows").select("steps").eq("id", inst.workflow_id).single();
              steps = Array.isArray(wf?.steps) ? wf!.steps as any[] : [];
            }
            const step = steps[payload.step_index];
            if (!step) {
              await supabaseAdmin.from("workflow_instances")
                .update({ status: "completed", completed_at: new Date().toISOString() })
                .eq("id", payload.instance_id);
              if (payload.run_id) await bumpProcessed(payload.run_id);
              await markDone(job.id); continue;
            }

            // Conditions branch into a sub-step list.
            if (step.type === "condition") {
              const truthy = await evaluateCondition(step, inst);
              const branch = truthy ? (step.then_steps ?? []) : (step.else_steps ?? []);
              if (branch.length) {
                await supabaseAdmin.from("job_queue").insert({
                  team_id: inst.team_id, job_type: "workflow_step",
                  scheduled_for: new Date().toISOString(),
                  payload: { instance_id: payload.instance_id, step_index: 0, run_id: payload.run_id, override_steps: branch },
                });
              } else {
                // Continue on the main path after the condition.
                await queueNext(steps, payload, inst.team_id, 0);
              }
              await markDone(job.id); processed++; continue;
            }

            await executeStep(step, inst, payload.run_id);

            await supabaseAdmin.from("workflow_instances")
              .update({ current_step: payload.step_index + 1 }).eq("id", payload.instance_id);

            // Schedule next; honour wait durations.
            const delayMs = step.type === "wait" ? waitMs(step.config) : isDelayStep(step) ? delayStepMs(step) : 0;
            await queueNext(steps, payload, inst.team_id, delayMs);
            await markDone(job.id); processed++;
          } catch (e: any) {
            const payload = job.payload as any;
            if (payload?.run_id) await bumpError(payload.run_id, e?.message ?? "error");
            await supabaseAdmin.from("job_queue")
              .update({ status: "failed", last_error: e?.message ?? "error", completed_at: new Date().toISOString() })
              .eq("id", job.id);
          }
        }
        return Response.json({ ok: true, processed });
      },
      GET: async () => Response.json({ ok: true, hint: "POST to drain" }),
    },
  },
});

async function queueNext(steps: any[], payload: any, teamId: string, delayMs: number) {
  const nextIndex = payload.step_index + 1;
  if (!steps[nextIndex]) {
    await supabaseAdmin.from("workflow_instances")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", payload.instance_id);
    if (payload.run_id) await bumpProcessed(payload.run_id);
    return;
  }
  await supabaseAdmin.from("job_queue").insert({
    team_id: teamId, job_type: "workflow_step",
    scheduled_for: new Date(Date.now() + delayMs).toISOString(),
    payload: { ...payload, step_index: nextIndex },
  });
}

async function markDone(id: string) {
  await supabaseAdmin.from("job_queue").update({ status: "complete", completed_at: new Date().toISOString() }).eq("id", id);
}

async function bumpProcessed(runId: string) {
  const { data: r } = await supabaseAdmin.from("workflow_runs" as any).select("contacts_processed").eq("id", runId).single() as any;
  await supabaseAdmin.from("workflow_runs" as any).update({
    contacts_processed: ((r?.contacts_processed ?? 0) as number) + 1,
    status: "completed",
    completed_at: new Date().toISOString(),
  } as any).eq("id", runId);
}

async function bumpError(runId: string, msg: string) {
  const { data: r } = await supabaseAdmin.from("workflow_runs" as any).select("errors,error_log").eq("id", runId).single() as any;
  const log = Array.isArray(r?.error_log) ? r!.error_log : [];
  await supabaseAdmin.from("workflow_runs" as any).update({
    errors: ((r?.errors ?? 0) as number) + 1,
    error_log: [...log, { at: new Date().toISOString(), msg }].slice(-50),
    status: "errored",
  } as any).eq("id", runId);
}

function isDelayStep(step: any) {
  return step.type === "wait_duration" || step.type === "wait_until_time" || step.type === "wait_business_day";
}
function delayStepMs(step: any): number {
  if (step.type === "wait_duration") return waitMs(step.config);
  if (step.type === "wait_until_time") {
    const [h, m] = String(step.config?.time ?? "09:00").split(":").map(Number);
    const next = new Date();
    next.setHours(h || 9, m || 0, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    return next.getTime() - Date.now();
  }
  if (step.type === "wait_business_day") {
    const next = new Date(); next.setDate(next.getDate() + 1); next.setHours(9, 0, 0, 0);
    while (next.getDay() === 0 || next.getDay() === 6) next.setDate(next.getDate() + 1);
    return next.getTime() - Date.now();
  }
  return 0;
}

function waitMs(cfg: any): number {
  const amount = Number(cfg?.amount ?? 0);
  const unit = cfg?.unit ?? "minutes";
  const mult = unit === "days" ? 86400_000 : unit === "hours" ? 3600_000 : 60_000;
  return amount * mult;
}

function renderTemplate(tpl: string, contact: any): string {
  if (!tpl) return "";
  return tpl
    .replace(/\{\{first_name\}\}/gi, (contact?.name ?? "").split(" ")[0] ?? "")
    .replace(/\{\{name\}\}/gi, contact?.name ?? "")
    .replace(/\{\{email\}\}/gi, contact?.email ?? "")
    .replace(/\{\{phone\}\}/gi, contact?.phone ?? "")
    .replace(/\{\{company\}\}/gi, contact?.company ?? "")
    .replace(/\{\{title\}\}/gi, contact?.title ?? "")
    .replace(/\{\{city\}\}/gi, contact?.city ?? "")
    .replace(/\{\{state\}\}/gi, contact?.state ?? "");
}

async function loadContact(id: string) {
  const { data } = await supabaseAdmin.from("contacts").select("*").eq("id", id).single();
  return data;
}

async function evaluateCondition(step: any, inst: any): Promise<boolean> {
  const contact = await loadContact(inst.contact_id);
  if (!contact) return false;
  const cfg = step.config ?? {};
  const blockId: string = cfg.blockId || "";
  switch (blockId) {
    case "condition.score_compare": {
      const v = contact.lead_score ?? 0; const t = Number(cfg.value ?? 0);
      return cfg.op === "lt" ? v < t : cfg.op === "eq" ? v === t : v > t;
    }
    case "condition.days_since_contact": {
      const last = contact.last_contacted_at ? new Date(contact.last_contacted_at).getTime() : 0;
      const days = last ? (Date.now() - last) / 86400_000 : 9999;
      return cfg.op === "lt" ? days < Number(cfg.days ?? 0) : days > Number(cfg.days ?? 0);
    }
    case "condition.has_replied": {
      const { data: msgs } = await supabaseAdmin.from("messages").select("id").eq("contact_id", contact.id).eq("direction", "inbound").limit(1);
      return (!!msgs?.length) === !!cfg.value;
    }
    case "condition.in_campaign": {
      const { data: camp } = await supabaseAdmin.from("campaigns").select("id").eq("team_id", inst.team_id).eq("name", cfg.campaign_name).maybeSingle();
      if (!camp) return false;
      const { data: cc } = await supabaseAdmin.from("campaign_contacts").select("id").eq("campaign_id", camp.id).eq("contact_id", contact.id).limit(1);
      return !!cc?.length;
    }
    case "condition.stage_equals": {
      const { data: stage } = await supabaseAdmin.from("pipeline_stages").select("id").eq("team_id", inst.team_id).eq("name", cfg.stage_name).maybeSingle();
      if (!stage) return false;
      const { data: lead } = await supabaseAdmin.from("pipeline_leads").select("id").eq("contact_id", contact.id).eq("stage_id", stage.id).limit(1);
      return !!lead?.length;
    }
    case "condition.custom_field_equals": {
      const cf = (contact.custom_fields ?? {}) as Record<string, any>;
      return String(cf[cfg.field] ?? "") === String(cfg.value ?? "");
    }
    case "condition.email_domain_contains": {
      return String(contact.email ?? "").toLowerCase().includes(String(cfg.needle ?? "").toLowerCase());
    }
    default: return false;
  }
}

async function executeStep(step: any, inst: any, runId?: string) {
  const { type, config } = step;
  const teamId = inst.team_id;
  const contactId = inst.contact_id;
  const contact = await loadContact(contactId);

  switch (type) {
    case "wait":
    case "wait_duration":
    case "wait_until_time":
    case "wait_business_day":
      return;

    case "add_tag": {
      const tags = new Set([...(contact?.tags ?? []), config.tag]);
      await supabaseAdmin.from("contacts").update({ tags: Array.from(tags) }).eq("id", contactId);
      break;
    }
    case "remove_tag": {
      const tags = (contact?.tags ?? []).filter((t: string) => t !== config.tag);
      await supabaseAdmin.from("contacts").update({ tags }).eq("id", contactId);
      break;
    }
    case "move_stage":
    case "change_stage": {
      const { data: stage } = await supabaseAdmin.from("pipeline_stages")
        .select("id").eq("team_id", teamId).eq("name", config.stage_name).maybeSingle();
      if (stage) {
        await supabaseAdmin.from("pipeline_leads").update({ stage_id: stage.id }).eq("contact_id", contactId).eq("team_id", teamId);
      }
      break;
    }
    case "update_score": {
      const newScore = Math.max(0, Math.min(100, (contact?.lead_score ?? 0) + Number(config.delta ?? 0)));
      await supabaseAdmin.from("contacts").update({ lead_score: newScore }).eq("id", contactId);
      break;
    }
    case "update_field": {
      const field = String(config.field || "").replace(/[^a-z_]/gi, "");
      if (!field) break;
      const value = renderTemplate(String(config.value ?? ""), contact);
      await supabaseAdmin.from("contacts").update({ [field]: value } as any).eq("id", contactId);
      break;
    }
    case "notify":
    case "send_notification": {
      await dispatchNotification({
        teamId,
        eventType: (config.event_type ?? "workflow_executed") as any,
        data: { reason: renderTemplate(config.message ?? "", contact), link: "" },
      });
      break;
    }
    case "send_email":
    case "send_sms":
    case "send_whatsapp": {
      await supabaseAdmin.from("messages").insert({
        team_id: teamId, contact_id: contactId,
        direction: "outbound", channel: type.replace("send_", ""),
        body: renderTemplate(config.message ?? config.body ?? "", contact),
        subject: type === "send_email" ? renderTemplate(config.subject ?? "", contact) : null,
        to_address: type === "send_email" ? contact?.email : contact?.phone,
        status: "queued",
      });
      break;
    }
    case "create_task": {
      const due = new Date(); due.setDate(due.getDate() + Number(config.due_in_days ?? 1));
      await supabaseAdmin.from("contacts").update({
        next_followup_at: due.toISOString(),
        notes: renderTemplate(config.title ?? "", contact),
      }).eq("id", contactId);
      break;
    }
    case "webhook_call": {
      if (config.url) {
        try {
          await fetch(config.url, {
            method: config.method || "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contact, workflow_run_id: runId }),
          });
        } catch { /* swallow */ }
      }
      break;
    }
    default: {
      await supabaseAdmin.from("activity_log").insert({
        team_id: teamId, contact_id: contactId, action: "workflow_step",
        channel: type, note: `Unhandled step type: ${type}`,
      });
    }
  }
}
