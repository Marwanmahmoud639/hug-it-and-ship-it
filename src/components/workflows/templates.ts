// Pre-built workflow templates. JSONB-serializable.
export type WorkflowStep =
  | { type: "wait"; config: { unit: "minutes" | "hours" | "days"; amount: number } }
  | { type: "send_email"; config: { template: string } }
  | { type: "send_sms"; config: { template: "A" | "B" | "C" } }
  | { type: "send_linkedin_dm"; config: { message: string } }
  | { type: "move_stage"; config: { stage_name: string } }
  | { type: "add_tag"; config: { tag: string } }
  | { type: "remove_tag"; config: { tag: string } }
  | { type: "assign"; config: { user_id: string } }
  | { type: "notify"; config: { user: "owner" | string; message: string } }
  | { type: "update_score"; config: { delta: number } }
  | { type: "condition"; config: { check: string; param?: any }; yes: WorkflowStep[]; no: WorkflowStep[] };

export type WorkflowTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
  trigger_type: string;
  trigger_config: Record<string, any>;
  steps: any[];
  stop_conditions: any[];
};

const STOP: any[] = [
  { type: "contact_replied" },
  { type: "opt_out_keyword" },
];

export const WORKFLOW_TEMPLATES = {
  high_score: {
    id: "high_score",
    name: "New High-Score Lead",
    description: "Auto-sequences new leads with score 70+",
    icon: "🎯",
    trigger_type: "lead_score_crosses",
    trigger_config: { threshold: 70, direction: "above" },
    steps: [
      { type: "wait", config: { unit: "minutes", amount: 15 } },
      { type: "send_email", config: { template: "Initial Outreach" } },
      { type: "wait", config: { unit: "days", amount: 3 } },
      {
        type: "condition",
        config: { check: "email_opened" },
        yes: [{ type: "send_email", config: { template: "Warm Follow-up" } }],
        no:  [{ type: "send_sms", config: { template: "A" } }],
      },
      { type: "wait", config: { unit: "days", amount: 5 } },
      {
        type: "condition",
        config: { check: "has_reply" },
        yes: [],
        no:  [{ type: "send_linkedin_dm", config: { message: "Hi {{first_name}} — circling back on my note." } }],
      },
      { type: "wait", config: { unit: "days", amount: 7 } },
      {
        type: "condition",
        config: { check: "has_reply" },
        yes: [],
        no:  [
          { type: "move_stage", config: { stage_name: "Not Interested" } },
          { type: "add_tag", config: { tag: "Re-engage-Q2" } },
          { type: "notify", config: { user: "owner", message: "Lead went cold after full sequence" } },
        ],
      },
    ],
    stop_conditions: STOP,
  },
  re_engagement: {
    id: "re_engagement",
    name: "Re-Engagement Sequence",
    description: "Revive cold leads with fresh angles",
    icon: "🔄",
    trigger_type: "lead_goes_cold",
    trigger_config: { days_inactive: 14 },
    steps: [
      { type: "wait", config: { unit: "days", amount: 1 } },
      { type: "send_email", config: { template: "Re-engagement" } },
      { type: "wait", config: { unit: "days", amount: 5 } },
      {
        type: "condition",
        config: { check: "email_opened" },
        yes: [{ type: "send_email", config: { template: "Last Attempt" } }],
        no:  [{ type: "send_sms", config: { template: "B" } }],
      },
      { type: "wait", config: { unit: "days", amount: 7 } },
      {
        type: "condition",
        config: { check: "has_reply" },
        yes: [],
        no:  [
          { type: "add_tag", config: { tag: "Unresponsive" } },
          { type: "move_stage", config: { stage_name: "Not Interested" } },
        ],
      },
    ],
    stop_conditions: STOP,
  },
  hot_lead: {
    id: "hot_lead",
    name: "Hot Lead Fast Track",
    description: "Instant follow-up for score 90+ leads",
    icon: "⚡",
    trigger_type: "lead_score_crosses",
    trigger_config: { threshold: 90, direction: "above" },
    steps: [
      { type: "wait", config: { unit: "minutes", amount: 5 } },
      { type: "send_email", config: { template: "Priority Outreach" } },
      { type: "wait", config: { unit: "days", amount: 1 } },
      {
        type: "condition",
        config: { check: "has_reply" },
        yes: [],
        no:  [{ type: "send_sms", config: { template: "A" } }],
      },
      { type: "wait", config: { unit: "days", amount: 1 } },
      {
        type: "condition",
        config: { check: "has_reply" },
        yes: [],
        no:  [
          { type: "send_linkedin_dm", config: { message: "{{first_name}} — quick priority note" } },
          { type: "notify", config: { user: "owner", message: "Hot lead hasn't responded — manual outreach recommended" } },
        ],
      },
    ],
    stop_conditions: STOP,
  },
} as const satisfies Record<string, WorkflowTemplate>;

export type WorkflowTemplateId = keyof typeof WORKFLOW_TEMPLATES;
