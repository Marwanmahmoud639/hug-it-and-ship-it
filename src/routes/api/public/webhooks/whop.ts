import { createFileRoute } from "@tanstack/react-router";
import { verifyWhopSignature } from "@/lib/whop.server";

export const Route = createFileRoute("/api/public/webhooks/whop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const sig = request.headers.get("x-whop-signature") ?? request.headers.get("whop-signature");
        if (!verifyWhopSignature(raw, sig)) {
          return new Response("invalid signature", { status: 401 });
        }
        let payload: any;
        try { payload = JSON.parse(raw); } catch {
          return new Response("invalid json", { status: 400 });
        }

        const action: string = payload.action ?? payload.event ?? payload.type ?? "";
        const data = payload.data ?? payload;
        const metadata = data.metadata ?? {};
        const email: string | null = (data.email ?? data.user?.email ?? data.user_email ?? data.buyer?.email ?? null);
        const buyerEmail = email ? email.toLowerCase() : null;
        const whopPaymentId: string | null = data.payment_id ?? data.id ?? null;
        const whopMembershipId: string | null = data.membership_id ?? data.membership?.id ?? data.id ?? null;
        const whopPlanId: string | null = data.plan_id ?? data.plan?.id ?? metadata.plan_id ?? null;
        const planSlug: string | null = metadata.plan_slug ?? null;
        const signupId: string | null = metadata.signup_id ?? metadata.order_id ?? null;
        const userId: string | null = metadata.user_id ?? data.user_id ?? null;
        const amount: number | null = data.amount != null ? Number(data.amount) : (data.subtotal != null ? Number(data.subtotal) : null);
        const currency: string = (data.currency ?? "usd").toLowerCase();
        const periodEnd: string | null = data.expires_at ?? data.renewal_period_end ?? null;

        let paymentStatus: string | null = null;
        let subStatus: string | null = null;
        let signupStatus: string | null = null;

        if (/payment\.succeeded/i.test(action)) {
          paymentStatus = "succeeded";
          signupStatus = "paid_pending_approval";
        } else if (/payment\.failed/i.test(action)) {
          paymentStatus = "failed";
        } else if (/payment\.refund|refund/i.test(action)) {
          paymentStatus = "refunded";
          subStatus = "canceled";
          signupStatus = "refunded";
        } else if (/membership\.(went_valid|activated|created)/i.test(action)) {
          subStatus = "active";
          signupStatus = signupStatus ?? "paid_pending_approval";
        } else if (/membership\.(deactivated|went_invalid|cancel)/i.test(action)) {
          subStatus = "canceled";
          signupStatus = signupStatus ?? "canceled";
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Resolve signup → user if metadata missing. If no signup row exists yet
        // (most common — Whop hosted checkout, no upfront signup), CREATE one now
        // so admin can see + approve from the queue.
        let resolvedUserId = userId;
        let resolvedSignupId = signupId;
        if (!resolvedSignupId && buyerEmail) {
          const { data: s } = await supabaseAdmin
            .from("signups")
            .select("id, user_id")
            .eq("email", buyerEmail)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (s) {
            resolvedSignupId = s.id;
            resolvedUserId = resolvedUserId ?? s.user_id;
          } else if (signupStatus === "paid_pending_approval") {
            // Infer plan slug from price if missing
            let inferredPlan = planSlug;
            if (!inferredPlan && amount) {
              if (amount >= 999) inferredPlan = "enterprise";
              else if (amount >= 499) inferredPlan = "professional";
              else inferredPlan = "starter";
            }
            const { data: ins } = await supabaseAdmin
              .from("signups")
              .insert({
                email: buyerEmail,
                full_name: (data.user?.name ?? data.buyer?.name ?? "") as string,
                selected_plan_slug: inferredPlan ?? "starter",
                status: "paid_pending_approval",
                whop_payment_id: whopPaymentId,
              })
              .select("id")
              .single();
            resolvedSignupId = ins?.id ?? null;
          }
        }

        // Insert payment row (idempotent on whop_payment_id)
        if (paymentStatus && whopPaymentId) {
          await supabaseAdmin.from("payments").upsert(
            {
              signup_id: resolvedSignupId,
              user_id: resolvedUserId,
              whop_payment_id: whopPaymentId,
              whop_membership_id: whopMembershipId,
              whop_plan_id: whopPlanId,
              buyer_email: buyerEmail,
              amount,
              currency,
              status: paymentStatus,
              raw: payload,
            },
            { onConflict: "whop_payment_id" },
          );
        }

        // Upsert subscription (idempotent on whop_membership_id)
        if (subStatus && whopMembershipId && resolvedUserId) {
          await supabaseAdmin.from("subscriptions").upsert(
            {
              user_id: resolvedUserId,
              plan_slug: planSlug,
              whop_membership_id: whopMembershipId,
              status: subStatus,
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "whop_membership_id" },
          );
        }

        // Update signup status
        if (signupStatus && resolvedSignupId) {
          await supabaseAdmin.from("signups").update({ status: signupStatus }).eq("id", resolvedSignupId);
        }

        // Legacy mirror (keep whop_purchases populated for now)
        if (whopPaymentId || whopMembershipId) {
          await supabaseAdmin.from("whop_purchases").upsert(
            {
              email: buyerEmail ?? "unknown@whop.local",
              tier: planSlug ?? whopPlanId ?? "unknown",
              whop_user_id: data.user_id ?? null,
              whop_session_id: data.session_id ?? data.checkout_id ?? whopPaymentId,
              whop_membership_id: whopMembershipId,
              status: paymentStatus ?? subStatus ?? "pending",
              raw_payload: payload,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "whop_session_id" },
          );
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
