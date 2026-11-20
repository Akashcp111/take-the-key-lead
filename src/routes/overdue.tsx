import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/overdue")({
  head: () => ({ meta: keyguardMeta("Overdue Keys", "Find active room key issues that have passed their return deadline.") }),
  component: () => <KeyguardApp view="overdue" />,
});