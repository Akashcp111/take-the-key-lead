import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: keyguardMeta("Record History", "Review transaction history and successful office register actions.") }),
  component: () => <KeyguardApp view="history" />,
});