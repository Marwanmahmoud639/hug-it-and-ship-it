import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendTaskAssignedEmail } from "./tasks.server";

const TaskTypeEnum = z.enum(["call", "email", "meeting", "follow_up", "other"]);
const PriorityEnum = z.enum(["high", "medium", "low"]);

const CreateTaskSchema = z.object({
  contact_id: z.string().uuid(),
  title: z.string().min(1).max(300),
  notes: z.string().max(5000).optional().nullable(),
  task_type: TaskTypeEnum.default("follow_up"),
  priority: PriorityEnum.default("medium"),
  due_at: z.string().datetime().optional().nullable(),
  reminder_offset_minutes: z.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
});

const UpdateTaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(300).optional(),
  notes: z.string().max(5000).optional().nullable(),
  task_type: TaskTypeEnum.optional(),
  priority: PriorityEnum.optional(),
  due_at: z.string().datetime().optional().nullable(),
  reminder_offset_minutes: z.number().int().min(0).max(60 * 24 * 30).optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  status: z.enum(["pending", "complete"]).optional(),
  completion_notes: z.string().max(2000).optional().nullable(),
});

export const listContactTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ contact_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("contact_id", data.contact_id)
      .order("status", { ascending: true })
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { tasks: tasks ?? [] };
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");

    const assignee = data.assigned_to ?? userId;
    const insert = {
      team_id: profile.team_id,
      contact_id: data.contact_id,
      user_id: assignee,
      created_by_user_id: userId,
      title: data.title,
      notes: data.notes ?? null,
      task_type: data.task_type,
      priority: data.priority,
      due_at: data.due_at ?? null,
      reminder_offset_minutes: data.reminder_offset_minutes ?? null,
      status: "pending" as const,
      source: "manual" as const,
    };
    const { data: task, error } = await supabase.from("tasks").insert(insert).select("*").single();
    if (error) throw new Error(error.message);

    // Notify on assignment if assignee != creator. Use admin client because notifications insert
    // requires team-scoped insert and we may notify a user other than the creator.
    if (assignee && assignee !== userId) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("name")
        .eq("id", data.contact_id)
        .maybeSingle();
      const { data: assigneeProfile } = await supabaseAdmin
        .from("profiles")
        .select("email,name")
        .eq("id", assignee)
        .maybeSingle();

      await supabaseAdmin.from("notifications").insert({
        team_id: profile.team_id,
        user_id: assignee,
        title: `New task: ${data.title}`,
        body: `${contact?.name ?? "Lead"}${data.due_at ? ` · due ${new Date(data.due_at).toLocaleString()}` : ""}`,
        type: "info",
        link: `/contacts/${data.contact_id}`,
      });

      if (assigneeProfile?.email) {
        await sendTaskAssignedEmail({
          to: assigneeProfile.email,
          toName: assigneeProfile.name || assigneeProfile.email,
          title: data.title,
          notes: data.notes ?? null,
          dueAt: data.due_at ?? null,
          contactName: contact?.name ?? "Lead",
          contactId: data.contact_id,
        }).catch((e) => console.error("[tasks] assign email failed", e));
      }

      await supabaseAdmin
        .from("tasks")
        .update({ assigned_notified_at: new Date().toISOString() })
        .eq("id", task.id);
    }

    return { task };
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => UpdateTaskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const patch: Partial<{
      title: string;
      notes: string | null;
      task_type: string;
      priority: string;
      due_at: string | null;
      reminder_offset_minutes: number | null;
      user_id: string | null;
      status: "pending" | "complete";
      completed_at: string | null;
      completion_notes: string | null;
    }> = {};
    if (data.title !== undefined) patch.title = data.title;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.task_type !== undefined) patch.task_type = data.task_type;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (data.due_at !== undefined) patch.due_at = data.due_at;
    if (data.reminder_offset_minutes !== undefined) patch.reminder_offset_minutes = data.reminder_offset_minutes;
    if (data.assigned_to !== undefined) patch.user_id = data.assigned_to;
    if (data.status !== undefined) {
      patch.status = data.status;
      patch.completed_at = data.status === "complete" ? new Date().toISOString() : null;
    }
    if (data.completion_notes !== undefined) patch.completion_notes = data.completion_notes;

    const { data: task, error } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { task };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("tasks").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTeamMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) return { members: [] };
    const { data, error } = await supabase
      .from("profiles")
      .select("id,name,email")
      .eq("team_id", profile.team_id);
    if (error) throw new Error(error.message);
    return { members: data ?? [] };
  });
