import { createFileRoute } from "@tanstack/react-router";
import { KeyguardApp } from "@/components/keyguard-app";
import { keyguardMeta } from "@/lib/route-meta";

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search["q"] === "string" ? search["q"] : "",
  }),
  head: () => ({ meta: keyguardMeta("Search Register", "Search keys, rooms, recipients, IDs, transactions, and statuses.") }),
  component: SearchRoute,
});

function SearchRoute() {
  const { q } = Route.useSearch();
  return <KeyguardApp view="search" searchTerm={q} />;
}