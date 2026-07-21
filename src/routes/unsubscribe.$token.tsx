import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/unsubscribe/$token")({
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const { token } = useParams({ from: "/unsubscribe/$token" });
  const [state, setState] = useState<"loading" | "ok" | "err">("loading");
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("contact_emails")
        .select("id, email, contact_id, is_unsubscribed")
        .eq("unsubscribe_token", token)
        .maybeSingle();
      if (error || !data) { setState("err"); return; }
      setEmail(data.email);
      if (!data.is_unsubscribed) {
        await supabase.from("contact_emails").update({
          is_unsubscribed: true,
          unsubscribed_at: new Date().toISOString(),
        }).eq("id", data.id);
      }
      setState("ok");
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-8 text-center">
        {state === "loading" && <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h1 className="text-xl font-semibold mt-4">You're unsubscribed</h1>
            <p className="text-sm text-muted-foreground mt-2">
              {email} will no longer receive marketing emails from us.
            </p>
          </>
        )}
        {state === "err" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-semibold mt-4">Invalid link</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This unsubscribe link is no longer valid.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
