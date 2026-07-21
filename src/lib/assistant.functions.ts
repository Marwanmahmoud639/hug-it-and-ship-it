import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const listConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, title, last_message_at, created_at")
      .eq("user_id", userId)
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { conversations: data ?? [] };
  });

export const createConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ title: z.string().max(120).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase.from("profiles").select("team_id").eq("id", userId).maybeSingle();
    const { data: conv, error } = await supabase
      .from("ai_conversations")
      .insert({ user_id: userId, team_id: (prof as any)?.team_id ?? null, title: data.title || "New chat" })
      .select("id, title, last_message_at, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { conversation: conv };
  });

export const getConversation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: conv, error } = await supabase
      .from("ai_conversations")
      .select("id, title, last_message_at, created_at")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Not found");
    const { data: msgs, error: e2 } = await supabase
      .from("ai_messages")
      .select("id, role, content, tool_name, tool_args, tool_result, created_at")
      .eq("conversation_id", data.id)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    return { conversation: conv, messages: msgs ?? [] };
  });

export const deleteConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("ai_conversations").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Sends a message and gets the assistant reply (non-streaming for simplicity).
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversationId: z.string().uuid(),
      content: z.string().min(1).max(8000),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { runAssistantTurn } = await import("./assistant-runner.server");
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id, team_id")
      .eq("id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!conv) throw new Error("Conversation not found");
    return runAssistantTurn({
      conversationId: data.conversationId,
      userId,
      teamId: (conv as any).team_id,
      userMessage: data.content,
      confirmActions: false,
    });
  });

// Confirms and executes a pending tool call (mutating tool).
export const confirmTool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      conversationId: z.string().uuid(),
      toolName: z.string().min(1).max(60),
      args: z.any(),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { confirmAndRunTool } = await import("./assistant-runner.server");
    const { data: conv } = await supabase
      .from("ai_conversations")
      .select("id, team_id")
      .eq("id", data.conversationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!conv) throw new Error("Conversation not found");
    return confirmAndRunTool({
      conversationId: data.conversationId,
      userId,
      teamId: (conv as any).team_id,
      toolName: data.toolName,
      args: data.args,
    });
  });
