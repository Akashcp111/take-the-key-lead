import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/issued")({
  head: () => ({ meta: keyguardMeta("Issued Keys", "Review active room key issues, recipients, and return deadlines.") }),
  component: () => <KeyguardApp view="issued" />,
});