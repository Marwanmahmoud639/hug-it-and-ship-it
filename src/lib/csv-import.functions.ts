import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dispatchNotification } from "@/lib/notifications.server";

const optStr = (max: number) => z.string().trim().max(max).optional().or(z.literal(""));
const RowSchema = z.object({
  name: z.string().trim().min(1, "name required").max(255),
  email: z.string().trim().email("invalid email").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  company: optStr(255),
  title: optStr(255),
  linkedin_url: optStr(500),
  city: optStr(120),
  state: optStr(120),
  country: optStr(120),
  website: optStr(500),
  priority: optStr(40),
  deal_value: z.string().trim().optional().or(z.literal("")),
  tags: optStr(500),
  custom_field_1: optStr(500),
  custom_field_2: optStr(500),
  custom_field_3: optStr(500),
});

export const createImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ fileName: z.string().min(1).max(255), totalRows: z.number().int().min(0).max(200_000) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { data: job, error } = await supabase
      .from("csv_import_jobs")
      .insert({ team_id: profile.team_id, user_id: userId, file_name: data.fileName, total_rows: data.totalRows, status: "importing" })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { jobId: job.id };
  });

export const importContactsBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      jobId: z.string().uuid(),
      rows: z.array(z.record(z.string(), z.any())).min(1).max(500),
      startIndex: z.number().int().min(0),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const teamId = profile.team_id;

    const valid: any[] = [];
    const errors: { row: number; data: any; errors: string[] }[] = [];

    data.rows.forEach((raw, i) => {
      const parsed = RowSchema.safeParse(raw);
      const rowNum = data.startIndex + i + 2; // header = row 1
      if (!parsed.success) {
        errors.push({ row: rowNum, data: raw, errors: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`) });
        return;
      }
      const v = parsed.data;
      if (!v.email && !v.phone) {
        errors.push({ row: rowNum, data: raw, errors: ["must have email or phone"] });
        return;
      }
      const dv = v.deal_value ? Number(v.deal_value.replace(/[^0-9.\-]/g, "")) : null;
      valid.push({
        team_id: teamId,
        name: v.name,
        email: v.email || null,
        phone: v.phone || null,
        company: v.company || null,
        title: v.title || null,
        linkedin_url: v.linkedin_url || null,
        city: v.city || null,
        state: v.state || null,
        country: v.country || null,
        website: v.website || null,
        priority: v.priority || null,
        deal_value: dv != null && !Number.isNaN(dv) ? dv : null,
        tags: v.tags ? v.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
        custom_field_1: v.custom_field_1 || null,
        custom_field_2: v.custom_field_2 || null,
        custom_field_3: v.custom_field_3 || null,
        source: "csv_import",
        email_verified: false,
        phone_verified: false,
      });
    });

    // Dedupe within team by email or phone
    let imported = 0;
    let dupeSkipped = 0;
    if (valid.length) {
      const emails = valid.map(v => v.email).filter(Boolean);
      const phones = valid.map(v => v.phone).filter(Boolean);
      const [{ data: existingByEmail }, { data: existingByPhone }] = await Promise.all([
        emails.length
          ? supabase.from("contacts").select("email").eq("team_id", teamId).in("email", emails)
          : Promise.resolve({ data: [] as { email: string | null }[] }),
        phones.length
          ? supabase.from("contacts").select("phone").eq("team_id", teamId).in("phone", phones)
          : Promise.resolve({ data: [] as { phone: string | null }[] }),
      ]);
      const dupeEmails = new Set((existingByEmail ?? []).map(r => r.email).filter(Boolean));
      const dupePhones = new Set((existingByPhone ?? []).map(r => r.phone).filter(Boolean));
      const toInsert = valid.filter(v => {
        const dupe = (v.email && dupeEmails.has(v.email)) || (v.phone && dupePhones.has(v.phone));
        if (dupe) {
          dupeSkipped++;
          errors.push({ row: 0, data: { name: v.name, email: v.email, phone: v.phone }, errors: ["duplicate (already in contacts)"] });
        }
        return !dupe;
      });
      if (toInsert.length) {
        const { data: ins, error: insErr } = await supabase.from("contacts").insert(toInsert).select("id");
        if (insErr) throw new Error(insErr.message);
        imported = ins?.length ?? 0;
      }
    }

    // Update job counters
    const { data: job } = await supabase
      .from("csv_import_jobs")
      .select("imported_rows, skipped_rows, error_rows")
      .eq("id", data.jobId)
      .single();
    const newImported = (job?.imported_rows ?? 0) + imported;
    const newSkipped = (job?.skipped_rows ?? 0) + errors.length;
    const prevErrors = Array.isArray(job?.error_rows) ? (job?.error_rows as any[]) : [];
    const newErrorRows = prevErrors.concat(errors).slice(0, 5000); // cap to keep row small
    await supabase
      .from("csv_import_jobs")
      .update({ imported_rows: newImported, skipped_rows: newSkipped, error_rows: newErrorRows })
      .eq("id", data.jobId);

    return { imported, skipped: errors.length, dupeSkipped };
  });

export const finalizeImportJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ jobId: z.string().uuid() }).parse)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("team_id").eq("id", userId).single();
    if (!profile?.team_id) throw new Error("No team");
    const { data: job } = await supabase
      .from("csv_import_jobs")
      .update({ status: "done", completed_at: new Date().toISOString() })
      .eq("id", data.jobId)
      .select("file_name, imported_rows, skipped_rows")
      .single();

    if (job) {
      try {
        await dispatchNotification({
          teamId: profile.team_id,
          eventType: "list_building_complete",
          data: { source: "CSV import", file_name: job.file_name, imported: job.imported_rows, skipped: job.skipped_rows },
        });
      } catch {
        // notification failure shouldn't break import
      }
    }
    return { ok: true };
  });
