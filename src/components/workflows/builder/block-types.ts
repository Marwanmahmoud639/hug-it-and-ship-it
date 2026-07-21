// Registry of all workflow builder block definitions.
// Drives palette, custom node rendering, and the right-hand config form.
import {
  UserPlus, TrendingUp, GitBranch, MailOpen, MousePointerClick, MessageSquare,
  Play, Webhook, Mail, MessageCircle, MessageSquareText, ListTodo,
  Edit3, Tag, TagsIcon, Send, Bell, ClockIcon, Hourglass, CalendarClock,
  HelpCircle, ArrowUpDown, CalendarDays, CheckCircle2, FilterIcon, Star, AtSign,
  type LucideIcon,
} from "lucide-react";

export type BlockCategory = "trigger" | "action" | "condition" | "delay";

export type BlockConfigField =
  | { key: string; label: string; type: "text" | "textarea" | "number"; placeholder?: string; mergeTags?: boolean; required?: boolean }
  | { key: string; label: string; type: "select"; options: { value: string; label: string }[]; required?: boolean }
  | { key: string; label: string; type: "boolean" };

export type BlockDef = {
  id: string;
  category: BlockCategory;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string; // tailwind class for the node header
  fields: BlockConfigField[];
  defaultConfig: Record<string, any>;
};

const COLORS = {
  trigger: "bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300",
  action: "bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300",
  condition: "bg-violet-500/15 border-violet-500/40 text-violet-700 dark:text-violet-300",
  delay: "bg-slate-500/15 border-slate-500/40 text-slate-700 dark:text-slate-300",
} as const;

export const BLOCK_DEFS: Record<string, BlockDef> = {
  // ---------------- TRIGGERS ----------------
  "trigger.contact_created": {
    id: "trigger.contact_created", category: "trigger", label: "New contact added",
    description: "Fires when a contact is created", icon: UserPlus, color: COLORS.trigger,
    fields: [], defaultConfig: {},
  },
  "trigger.score_above": {
    id: "trigger.score_above", category: "trigger", label: "Contact scored above",
    description: "Fires when lead score crosses a threshold", icon: TrendingUp, color: COLORS.trigger,
    fields: [{ key: "threshold", label: "Threshold", type: "number", required: true }],
    defaultConfig: { threshold: 70 },
  },
  "trigger.stage_changed": {
    id: "trigger.stage_changed", category: "trigger", label: "Pipeline stage changed to",
    description: "Fires when a contact reaches a stage", icon: GitBranch, color: COLORS.trigger,
    fields: [{ key: "stage_name", label: "Stage name", type: "text", required: true, placeholder: "Qualified" }],
    defaultConfig: { stage_name: "" },
  },
  "trigger.email_opened_n": {
    id: "trigger.email_opened_n", category: "trigger", label: "Email opened N times",
    description: "Fires after multiple email opens", icon: MailOpen, color: COLORS.trigger,
    fields: [{ key: "count", label: "Open count", type: "number", required: true }],
    defaultConfig: { count: 3 },
  },
  "trigger.link_clicked": {
    id: "trigger.link_clicked", category: "trigger", label: "Link clicked",
    description: "Fires when a tracked link is clicked", icon: MousePointerClick, color: COLORS.trigger,
    fields: [], defaultConfig: {},
  },
  "trigger.sms_replied": {
    id: "trigger.sms_replied", category: "trigger", label: "SMS replied",
    description: "Fires when contact replies to SMS", icon: MessageSquare, color: COLORS.trigger,
    fields: [], defaultConfig: {},
  },
  "trigger.manual": {
    id: "trigger.manual", category: "trigger", label: "Manual trigger",
    description: "Only runs when started manually", icon: Play, color: COLORS.trigger,
    fields: [], defaultConfig: {},
  },
  "trigger.webhook": {
    id: "trigger.webhook", category: "trigger", label: "Webhook received",
    description: "Fires on inbound webhook", icon: Webhook, color: COLORS.trigger,
    fields: [{ key: "path", label: "Path slug", type: "text", placeholder: "lead-form" }],
    defaultConfig: { path: "" },
  },

  // ---------------- ACTIONS ----------------
  "action.send_email": {
    id: "action.send_email", category: "action", label: "Send email",
    description: "Send a personalized email", icon: Mail, color: COLORS.action,
    fields: [
      { key: "subject", label: "Subject", type: "text", mergeTags: true, required: true },
      { key: "body", label: "Body", type: "textarea", mergeTags: true, required: true },
    ],
    defaultConfig: { subject: "", body: "" },
  },
  "action.send_sms": {
    id: "action.send_sms", category: "action", label: "Send SMS",
    description: "Send a text message", icon: MessageCircle, color: COLORS.action,
    fields: [{ key: "message", label: "Message", type: "textarea", mergeTags: true, required: true }],
    defaultConfig: { message: "" },
  },
  "action.send_whatsapp": {
    id: "action.send_whatsapp", category: "action", label: "Send WhatsApp",
    description: "Send a WhatsApp message", icon: MessageSquareText, color: COLORS.action,
    fields: [{ key: "message", label: "Message", type: "textarea", mergeTags: true, required: true }],
    defaultConfig: { message: "" },
  },
  "action.create_task": {
    id: "action.create_task", category: "action", label: "Create task",
    description: "Create a follow-up task", icon: ListTodo, color: COLORS.action,
    fields: [
      { key: "title", label: "Title", type: "text", mergeTags: true, required: true },
      { key: "due_in_days", label: "Due in days", type: "number" },
    ],
    defaultConfig: { title: "Call {{first_name}}", due_in_days: 1 },
  },
  "action.update_field": {
    id: "action.update_field", category: "action", label: "Update contact field",
    description: "Set a contact field to a value", icon: Edit3, color: COLORS.action,
    fields: [
      { key: "field", label: "Field", type: "select", required: true, options: [
        { value: "name", label: "Name" },
        { value: "company", label: "Company" },
        { value: "title", label: "Title" },
        { value: "industry", label: "Industry" },
        { value: "priority", label: "Priority" },
        { value: "notes", label: "Notes" },
      ]},
      { key: "value", label: "Value", type: "text", mergeTags: true, required: true },
    ],
    defaultConfig: { field: "company", value: "" },
  },
  "action.change_stage": {
    id: "action.change_stage", category: "action", label: "Change pipeline stage",
    description: "Move contact to a new stage", icon: ArrowUpDown, color: COLORS.action,
    fields: [{ key: "stage_name", label: "Stage name", type: "text", required: true }],
    defaultConfig: { stage_name: "" },
  },
  "action.add_tag": {
    id: "action.add_tag", category: "action", label: "Add tag",
    description: "Add a tag to the contact", icon: Tag, color: COLORS.action,
    fields: [{ key: "tag", label: "Tag", type: "text", required: true }],
    defaultConfig: { tag: "" },
  },
  "action.remove_tag": {
    id: "action.remove_tag", category: "action", label: "Remove tag",
    description: "Remove a tag from the contact", icon: TagsIcon, color: COLORS.action,
    fields: [{ key: "tag", label: "Tag", type: "text", required: true }],
    defaultConfig: { tag: "" },
  },
  "action.webhook_call": {
    id: "action.webhook_call", category: "action", label: "Call webhook",
    description: "POST contact JSON to external URL", icon: Send, color: COLORS.action,
    fields: [
      { key: "url", label: "URL", type: "text", required: true, placeholder: "https://..." },
      { key: "method", label: "Method", type: "select", options: [
        { value: "POST", label: "POST" }, { value: "GET", label: "GET" }, { value: "PUT", label: "PUT" },
      ]},
    ],
    defaultConfig: { url: "", method: "POST" },
  },
  "action.send_notification": {
    id: "action.send_notification", category: "action", label: "Send notification",
    description: "Notify team via Slack / Discord / Telegram / WhatsApp", icon: Bell, color: COLORS.action,
    fields: [
      { key: "event_type", label: "Event type", type: "select", required: true, options: [
        { value: "workflow_executed", label: "Workflow executed" },
        { value: "system_alert", label: "System alert" },
        { value: "campaign_milestone", label: "Campaign milestone" },
      ]},
      { key: "message", label: "Message", type: "textarea", mergeTags: true, required: true },
    ],
    defaultConfig: { event_type: "workflow_executed", message: "" },
  },

  // ---------------- CONDITIONS ----------------
  "condition.score_compare": {
    id: "condition.score_compare", category: "condition", label: "If lead score",
    description: "Branch on score comparison", icon: Star, color: COLORS.condition,
    fields: [
      { key: "op", label: "Operator", type: "select", required: true, options: [
        { value: "gt", label: ">" }, { value: "lt", label: "<" }, { value: "eq", label: "=" },
      ]},
      { key: "value", label: "Value", type: "number", required: true },
    ],
    defaultConfig: { op: "gt", value: 70 },
  },
  "condition.days_since_contact": {
    id: "condition.days_since_contact", category: "condition", label: "If days since last contact",
    description: "Branch on contact recency", icon: CalendarDays, color: COLORS.condition,
    fields: [
      { key: "op", label: "Operator", type: "select", required: true, options: [
        { value: "gt", label: ">" }, { value: "lt", label: "<" },
      ]},
      { key: "days", label: "Days", type: "number", required: true },
    ],
    defaultConfig: { op: "gt", days: 5 },
  },
  "condition.has_replied": {
    id: "condition.has_replied", category: "condition", label: "If contact has replied",
    description: "Branch on reply status", icon: CheckCircle2, color: COLORS.condition,
    fields: [{ key: "value", label: "Has replied", type: "boolean" }],
    defaultConfig: { value: true },
  },
  "condition.in_campaign": {
    id: "condition.in_campaign", category: "condition", label: "If in campaign",
    description: "Branch on active campaign membership", icon: FilterIcon, color: COLORS.condition,
    fields: [{ key: "campaign_name", label: "Campaign name", type: "text", required: true }],
    defaultConfig: { campaign_name: "" },
  },
  "condition.stage_equals": {
    id: "condition.stage_equals", category: "condition", label: "If pipeline stage =",
    description: "Branch on current stage", icon: GitBranch, color: COLORS.condition,
    fields: [{ key: "stage_name", label: "Stage name", type: "text", required: true }],
    defaultConfig: { stage_name: "" },
  },
  "condition.custom_field_equals": {
    id: "condition.custom_field_equals", category: "condition", label: "If custom field =",
    description: "Branch on a custom field value", icon: HelpCircle, color: COLORS.condition,
    fields: [
      { key: "field", label: "Field key", type: "text", required: true },
      { key: "value", label: "Value", type: "text", required: true },
    ],
    defaultConfig: { field: "", value: "" },
  },
  "condition.email_domain_contains": {
    id: "condition.email_domain_contains", category: "condition", label: "If email domain contains",
    description: "Branch on email domain substring", icon: AtSign, color: COLORS.condition,
    fields: [{ key: "needle", label: "Substring", type: "text", required: true, placeholder: "gmail" }],
    defaultConfig: { needle: "gmail" },
  },

  // ---------------- DELAYS ----------------
  "delay.wait_duration": {
    id: "delay.wait_duration", category: "delay", label: "Wait duration",
    description: "Pause for a fixed amount of time", icon: Hourglass, color: COLORS.delay,
    fields: [
      { key: "amount", label: "Amount", type: "number", required: true },
      { key: "unit", label: "Unit", type: "select", required: true, options: [
        { value: "minutes", label: "Minutes" }, { value: "hours", label: "Hours" }, { value: "days", label: "Days" },
      ]},
    ],
    defaultConfig: { amount: 1, unit: "hours" },
  },
  "delay.wait_until_time": {
    id: "delay.wait_until_time", category: "delay", label: "Wait until time",
    description: "Resume at a specific time of day", icon: ClockIcon, color: COLORS.delay,
    fields: [{ key: "time", label: "Time (HH:MM, 24h)", type: "text", required: true, placeholder: "09:00" }],
    defaultConfig: { time: "09:00" },
  },
  "delay.wait_business_day": {
    id: "delay.wait_business_day", category: "delay", label: "Wait until next business day",
    description: "Resume at 9am Mon–Fri", icon: CalendarClock, color: COLORS.delay,
    fields: [], defaultConfig: {},
  },
};

export const MERGE_TAGS = [
  "{{first_name}}", "{{name}}", "{{email}}", "{{phone}}",
  "{{company}}", "{{title}}", "{{city}}", "{{state}}",
];

export function blocksByCategory(cat: BlockCategory) {
  return Object.values(BLOCK_DEFS).filter(b => b.category === cat);
}

export function getBlockDef(id: string): BlockDef | undefined {
  return BLOCK_DEFS[id];
}
