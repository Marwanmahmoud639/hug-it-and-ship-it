import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTaskReminderEmail } from "@/lib/tasks.server";

// Sweep for tasks whose reminder offset has elapsed.
// Cron calls this every minute via pg_cron.
export const Route = createFileRoute("/api/public/hooks/run-task-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const now = new Date();
        const nowIso = now.toISOString();

        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id,team_id,contact_id,user_id,title,notes,due_at,reminder_offset_minutes")
          .eq("status", "pending")
          .is("reminder_sent_at", null)
          .not("reminder_offset_minutes", "is", null)
          .not("due_at", "is", null)
          .limit(200);

        if (error) return Response.json({ error: error.message }, { status: 500 });

        let sent = 0;
        const errors: string[] = [];

        for (const t of tasks ?? []) {
          if (!t.due_at || t.reminder_offset_minutes == null) continue;
          const dueMs = new Date(t.due_at).getTime();
          const triggerMs = dueMs - t.reminder_offset_minutes * 60_000;
          if (triggerMs > now.getTime()) continue;

          try {
            const [{ data: contact }, { data: assignee }] = await Promise.all([
              supabaseAdmin.from("contacts").select("name").eq("id", t.contact_id ?? "").maybeSingle(),
              t.user_id
                ? supabaseAdmin.from("profiles").select("email,name").eq("id", t.user_id).maybeSingle()
                : Promise.resolve({ data: null }),
            ]);

            await supabaseAdmin.from("notifications").insert({
              team_id: t.team_id,
              user_id: t.user_id,
              title: `Reminder: ${t.title}`,
              body: `${contact?.name ?? "Lead"} · due ${new Date(t.due_at).toLocaleString()}`,
              type: "warning",
              link: t.contact_id ? `/contacts/${t.contact_id}` : null,
            });

            if (assignee?.email) {
              await sendTaskReminderEmail({
                to: assignee.email,
                toName: assignee.name || assignee.email,
                title: t.title,
                notes: t.notes ?? null,
                dueAt: t.due_at,
                contactName: contact?.name ?? "Lead",
                contactId: t.contact_id ?? "",
              }).catch((e) => errors.push(`email ${t.id}: ${e instanceof Error ? e.message : String(e)}`));
            }

            await supabaseAdmin.from("tasks").update({ reminder_sent_at: nowIso }).eq("id", t.id);
            sent++;
          } catch (e) {
            errors.push(`task ${t.id}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }

        return Response.json({ checked: tasks?.length ?? 0, sent, errors });
      },
    },
  },
});
