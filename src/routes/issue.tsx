import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/issue")({
  head: () => ({ meta: keyguardMeta("Issue a Key", "Record a room key issue, recipient, and return deadline.") }),
  component: () => <KeyguardApp view="issue" />,
});