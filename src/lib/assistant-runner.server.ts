import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TOOL_SCHEMAS, MUTATING_TOOLS, executeTool, type ToolCtx } from "./assistant-tools.server";

const SYSTEM_PROMPT = `You are the Dialing For Dollars in-app assistant. You help real-estate/B2B prospectors:
- find owner contact info (reverse lookup by name, phone, or address) — US and Canada only
- search their existing leads database
- summarize dashboard stats
- save new leads, create tasks, run bulk prospect searches

Rules:
- ALWAYS check the user's contacts DB first (search_contacts_db) before calling reverse_lookup_web.
- For mutating actions (save_lookup_to_lead, create_task, bulk_prospect_search) you MUST first propose the action in plain text and wait for the user to confirm. Do NOT call those tools directly without an explicit "yes/confirm".
- Reverse lookup is US/CA only. Refuse other countries politely.
- Be concise. Use markdown. Cite source URLs from lookup results.
- If you don't know, say so — don't fabricate phone numbers or addresses.`;

const MODEL = "google/gemini-2.5-flash";

type RunArgs = {
  conversationId: string;
  userId: string;
  teamId: string | null;
  userMessage: string;
  confirmActions: boolean;
};

async function loadHistory(conversationId: string) {
  const { data } = await supabaseAdmin
    .from("ai_messages")
    .select("role, content, tool_name, tool_args, tool_result, tool_call_id")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(50);
  return data ?? [];
}

function toGatewayMessages(history: any[]) {
  const out: any[] = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of history) {
    if (m.role === "user" || m.role === "assistant") {
      out.push({ role: m.role, content: m.content || "" });
    } else if (m.role === "tool") {
      out.push({
        role: "tool",
        tool_call_id: m.tool_call_id || m.tool_name,
        content: JSON.stringify(m.tool_result ?? {}),
      });
    }
  }
  return out;
}

async function callGateway(messages: any[]) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Lovable AI not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOL_SCHEMAS,
      tool_choice: "auto",
    }),
  });
  if (res.status === 429) throw new Error("Rate limited — try again in a moment");
  if (res.status === 402) throw new Error("AI credits exhausted — please add credits in Workspace settings");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway error ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message;
}

export async function runAssistantTurn(args: RunArgs) {
  const ctx: ToolCtx = { userId: args.userId, teamId: args.teamId };

  // Persist user message
  await supabaseAdmin.from("ai_messages").insert({
    conversation_id: args.conversationId,
    role: "user",
    content: args.userMessage,
  });
  await supabaseAdmin
    .from("ai_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", args.conversationId);

  let history = await loadHistory(args.conversationId);
  const newMessages: any[] = [];

  // Up to 4 tool-call rounds, then force a text reply.
  for (let round = 0; round < 4; round++) {
    const reply = await callGateway(toGatewayMessages(history));
    const toolCalls = reply?.tool_calls as any[] | undefined;

    if (!toolCalls || toolCalls.length === 0) {
      // Final assistant text
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: args.conversationId,
        role: "assistant",
        content: reply?.content || "(no response)",
        model: MODEL,
      });
      newMessages.push({ role: "assistant", content: reply?.content || "" });
      break;
    }

    // Process each tool call
    for (const tc of toolCalls) {
      const name = tc.function?.name as string;
      let parsedArgs: any = {};
      try {
        parsedArgs = tc.function?.arguments ? JSON.parse(tc.function.arguments) : {};
      } catch {
        parsedArgs = {};
      }

      if (MUTATING_TOOLS.has(name)) {
        // Don't execute — surface as a confirmation card for the UI.
        const proposalText = reply?.content || `I'd like to run **${name}**. Please confirm.`;
        await supabaseAdmin.from("ai_messages").insert({
          conversation_id: args.conversationId,
          role: "assistant",
          content: proposalText,
          tool_name: name,
          tool_args: parsedArgs,
          model: MODEL,
        });
        newMessages.push({ role: "assistant", content: proposalText, pending_tool: name, pending_args: parsedArgs });
        return { messages: newMessages };
      }

      // Read-only tool — execute, persist, continue loop.
      let result: any;
      try {
        result = await executeTool(name, parsedArgs, ctx);
      } catch (e: any) {
        result = { error: e?.message || "Tool failed" };
      }
      await supabaseAdmin.from("ai_messages").insert({
        conversation_id: args.conversationId,
        role: "tool",
        tool_name: name,
        tool_args: parsedArgs,
        tool_result: result,
        tool_call_id: tc.id,
      });
      history = await loadHistory(args.conversationId);
    }
  }

  return { messages: newMessages };
}

export async function confirmAndRunTool(args: {
  conversationId: string;
  userId: string;
  teamId: string | null;
  toolName: string;
  args: any;
}) {
  const ctx: ToolCtx = { userId: args.userId, teamId: args.teamId };
  let result: any;
  try {
    result = await executeTool(args.toolName, args.args, ctx);
  } catch (e: any) {
    result = { error: e?.message || "Tool failed" };
  }
  await supabaseAdmin.from("ai_messages").insert({
    conversation_id: args.conversationId,
    role: "tool",
    tool_name: args.toolName,
    tool_args: args.args,
    tool_result: result,
  });

  // Ask the model to summarize the result.
  const history = await loadHistory(args.conversationId);
  const reply = await callGateway(toGatewayMessages(history));
  const text = reply?.content || (result?.error ? `Failed: ${result.error}` : "Done.");
  await supabaseAdmin.from("ai_messages").insert({
    conversation_id: args.conversationId,
    role: "assistant",
    content: text,
    model: MODEL,
  });
  await supabaseAdmin
    .from("ai_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", args.conversationId);

  return { result, summary: text };
}
