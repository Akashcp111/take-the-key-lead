import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  CircleCheck,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  History,
  KeyRound,
  KeySquare,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { KeyGuardError } from "@/lib/keyguard-errors";
import {
  KeyService,
  type ActiveTransaction,
  type AuditEvent,
  type DashboardCounts,
  type DueSoonTransaction,
  type KeyRecord,
  type KeyTransaction,
  type OverdueTransaction,
} from "@/lib/keyguard-service";

export type KeyguardView =
  | "dashboard"
  | "keys"
  | "register"
  | "issue"
  | "return"
  | "issued"
  | "overdue"
  | "due-soon"
  | "search"
  | "history";

interface KeyguardAppProps {
  view: KeyguardView;
  searchTerm?: string;
}

interface Notice {
  kind: "success" | "error";
  text: string;
}

const PAGE_DETAILS: Record<KeyguardView, { title: string; description: string; eyebrow: string }> = {
  dashboard: {
    title: "Room key register",
    description: "A clear view of every room key, issue, and return deadline.",
    eyebrow: "Office overview",
  },
  keys: {
    title: "Key inventory",
    description: "Every registered key and its current availability.",
    eyebrow: "Inventory",
  },
  register: {
    title: "Register a key",
    description: "Add a room key to the office inventory.",
    eyebrow: "Inventory",
  },
  issue: {
    title: "Issue a key",
    description: "Record who has collected a key and when it is due back.",
    eyebrow: "Key operations",
  },
  return: {
    title: "Return a key",
    description: "Close an active issue record and make the key available again.",
    eyebrow: "Key operations",
  },
  issued: {
    title: "Issued keys",
    description: "Track active key loans and their current deadlines.",
    eyebrow: "Key operations",
  },
  overdue: {
    title: "Overdue keys",
    description: "Active key issues past their return deadline.",
    eyebrow: "Reports",
  },
  "due-soon": {
    title: "Due soon",
    description: "Active key issues due within the next 30 minutes.",
    eyebrow: "Reports",
  },
  search: {
    title: "Search register",
    description: "Find a key, room, recipient, ID, or transaction.",
    eyebrow: "Records",
  },
  history: {
    title: "Record history",
    description: "Review completed and active transactions alongside office actions.",
    eyebrow: "Records",
  },
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours} h ${remainder} min`;
  if (hours) return `${hours} h`;
  return `${remainder} min`;
}

function statusClass(status: string): string {
  return `kg-status kg-status-${status.toLocaleLowerCase().replaceAll(" ", "_")}`;
}

function StatusBadge({ status }: { status: string }) {
  return <span className={statusClass(status)}>{status}</span>;
}

function ActionLink({
  to,
  children,
  variant = "default",
}: {
  to: "/issue" | "/return" | "/overdue" | "/keys" | "/keys/register" | "/issued" | "/due-soon" | "/history";
  children: ReactNode;
  variant?: "default" | "outline" | "secondary";
}) {
  return (
    <Button asChild variant={variant} className="kg-button-touch">
      <Link to={to} className="kg-button-link">
        {children}
      </Link>
    </Button>
  );
}

function Sidebar({ view }: { view: KeyguardView }) {
  const active = (...views: KeyguardView[]) => views.includes(view);
  const itemClass = (isCurrent: boolean) => "kg-nav-item" + (isCurrent ? " kg-nav-current" : "");

  return (
    <aside className="kg-sidebar">
      <Link to="/" className="kg-brand" aria-label="KEYGUARD dashboard">
        <span className="kg-brand-mark"><KeyRound size={22} aria-hidden="true" /></span>
        <span>
          <span className="kg-brand-title">KEYGUARD</span>
          <span className="kg-brand-subtitle">Room key register</span>
        </span>
      </Link>
      <nav aria-label="Main navigation">
        <div className="kg-nav-group">
          <p className="kg-nav-label">Workspace</p>
          <Link to="/" className={itemClass(active("dashboard"))} aria-current={active("dashboard") ? "page" : undefined}>
            <ClipboardList size={18} aria-hidden="true" /> Overview
          </Link>
          <Link to="/keys" className={itemClass(active("keys", "register"))} aria-current={active("keys", "register") ? "page" : undefined}>
            <KeySquare size={18} aria-hidden="true" /> Key inventory
          </Link>
          <Link to="/issued" className={itemClass(active("issued"))} aria-current={active("issued") ? "page" : undefined}>
            <ClipboardCheck size={18} aria-hidden="true" /> Issued keys
          </Link>
        </div>
        <div className="kg-nav-group">
          <p className="kg-nav-label">Key operations</p>
          <Link to="/issue" className={itemClass(active("issue"))} aria-current={active("issue") ? "page" : undefined}>
            <KeyRound size={18} aria-hidden="true" /> Issue a key
          </Link>
          <Link to="/return" className={itemClass(active("return"))} aria-current={active("return") ? "page" : undefined}>
            <RotateCcw size={18} aria-hidden="true" /> Return a key
          </Link>
        </div>
        <div className="kg-nav-group">
          <p className="kg-nav-label">Reports & records</p>
          <Link to="/overdue" className={itemClass(active("overdue"))} aria-current={active("overdue") ? "page" : undefined}>
            <AlertTriangle size={18} aria-hidden="true" /> Overdue
          </Link>
          <Link to="/due-soon" className={itemClass(active("due-soon"))} aria-current={active("due-soon") ? "page" : undefined}>
            <CalendarClock size={18} aria-hidden="true" /> Due soon
          </Link>
          <Link to="/search" className={itemClass(active("search"))} aria-current={active("search") ? "page" : undefined}>
            <Search size={18} aria-hidden="true" /> Search
          </Link>
          <Link to="/history" className={itemClass(active("history"))} aria-current={active("history") ? "page" : undefined}>
            <History size={18} aria-hidden="true" /> History
          </Link>
        </div>
      </nav>
      <div className="kg-sidebar-bottom">
        <div className="kg-demo-note">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Academic prototype<br />Fictional sample data only</span>
        </div>
      </div>
    </aside>
  );
}

function PageHeading({ view, action }: { view: KeyguardView; action?: ReactNode }) {
  const page = PAGE_DETAILS[view];
  return (
    <header className="kg-page-heading">
      <div>
        <p className="kg-eyebrow">{page.eyebrow}</p>
        <h1 className="kg-page-title">{page.title}</h1>
        <p className="kg-page-description">{page.description}</p>
      </div>
      {action}
    </header>
  );
}

function KeyTable({ keys }: { keys: KeyRecord[] }) {
  if (keys.length === 0) {
    return <EmptyState title="No keys registered" detail="Register a room key to start the inventory." />;
  }
  return (
    <div className="kg-table-wrap">
      <table className="kg-table">
        <thead><tr><th>Key ID</th><th>Room</th><th>Location</th><th>Status</th></tr></thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key.key_id}>
              <td className="kg-mono">{key.key_id}</td>
              <td>{key.room}</td>
              <td>{key.location}</td>
              <td><StatusBadge status={key.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="kg-empty-state">
      <div>
        <strong>{title}</strong>
        {detail && <span>{detail}</span>}
      </div>
    </div>
  );
}

function ActiveTable({ transactions }: { transactions: ActiveTransaction[] }) {
  if (!transactions.length) return <EmptyState title="No issued keys" detail="Active key issues will appear here." />;
  return (
    <div className="kg-table-wrap">
      <table className="kg-table">
        <thead><tr><th>Transaction</th><th>Room</th><th>Recipient</th><th>Issued</th><th>Due back</th><th>Status</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.transaction_id}>
              <td className="kg-mono">{transaction.transaction_id}<span className="kg-subline">{transaction.key_id}</span></td>
              <td>{transaction.room}<span className="kg-subline">{transaction.location}</span></td>
              <td>{transaction.recipient}<span className="kg-subline">{transaction.recipient_id}</span></td>
              <td>{formatDateTime(transaction.issue_date)}</td>
              <td>{formatDateTime(transaction.due_date)}</td>
              <td><StatusBadge status={transaction.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionHistoryTable({ transactions, keys }: { transactions: KeyTransaction[]; keys: KeyRecord[] }) {
  if (!transactions.length) return <EmptyState title="No transaction history" detail="Issue and return records will appear here." />;
  return (
    <div className="kg-table-wrap">
      <table className="kg-table">
        <thead><tr><th>Transaction</th><th>Key / room</th><th>Recipient</th><th>Issued</th><th>Due back</th><th>Returned</th><th>Status</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => {
            const key = keys.find((candidate) => candidate.key_id === transaction.key_id);
            return (
              <tr key={transaction.transaction_id}>
                <td className="kg-mono">{transaction.transaction_id}</td>
                <td>{transaction.key_id}<span className="kg-subline">{key?.room ?? "Unknown room"}</span></td>
                <td>{transaction.recipient}<span className="kg-subline">{transaction.recipient_id}</span></td>
                <td>{formatDateTime(transaction.issue_date)}</td>
                <td>{formatDateTime(transaction.due_date)}</td>
                <td>{transaction.return_date ? formatDateTime(transaction.return_date) : "—"}</td>
                <td><StatusBadge status={transaction.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OverdueTable({ transactions }: { transactions: OverdueTransaction[] }) {
  if (!transactions.length) return <EmptyState title="No overdue keys." detail="There are no active issues past their due time." />;
  return (
    <div className="kg-table-wrap">
      <table className="kg-table">
        <thead><tr><th>Transaction</th><th>Room</th><th>Recipient</th><th>Due time</th><th>Overdue by</th><th>Action</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.transaction_id}>
              <td className="kg-mono">{transaction.transaction_id}<span className="kg-subline">{transaction.key_id}</span></td>
              <td>{transaction.room}<span className="kg-subline">{transaction.location}</span></td>
              <td>{transaction.recipient}<span className="kg-subline">{transaction.recipient_id}</span></td>
              <td>{formatDateTime(transaction.due_date)}</td>
              <td><StatusBadge status="OVERDUE" /><span className="kg-subline">{formatDuration(transaction.overdue_minutes)}</span></td>
              <td><Button asChild variant="outline" className="kg-button-touch"><Link to="/return">Return key</Link></Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DueSoonTable({ transactions }: { transactions: DueSoonTransaction[] }) {
  if (!transactions.length) return <EmptyState title="Nothing due soon" detail="No active keys are due within the next 30 minutes." />;
  return (
    <div className="kg-table-wrap">
      <table className="kg-table">
        <thead><tr><th>Transaction</th><th>Room</th><th>Recipient</th><th>Due time</th><th>Time remaining</th></tr></thead>
        <tbody>
          {transactions.map((transaction) => (
            <tr key={transaction.transaction_id}>
              <td className="kg-mono">{transaction.transaction_id}<span className="kg-subline">{transaction.key_id}</span></td>
              <td>{transaction.room}<span className="kg-subline">{transaction.location}</span></td>
              <td>{transaction.recipient}<span className="kg-subline">{transaction.recipient_id}</span></td>
              <td>{formatDateTime(transaction.due_date)}</td>
              <td><StatusBadge status="DUE SOON" /><span className="kg-subline">{transaction.minutes_remaining} min remaining</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardPage({
  service,
  counts,
  onReset,
}: {
  service: KeyService;
  counts: DashboardCounts;
  onReset: () => void;
}) {
  const overdue = service.list_overdue().slice(0, 3);
  const stats = [
    { label: "Total keys", value: counts.total, icon: <KeySquare size={19} /> },
    { label: "Available", value: counts.available, icon: <CircleCheck size={19} /> },
    { label: "Issued", value: counts.issued, icon: <ClipboardCheck size={19} /> },
    { label: "Overdue", value: counts.overdue, icon: <AlertTriangle size={19} /> },
    { label: "Due soon", value: counts.due_soon, icon: <Clock3 size={19} /> },
    { label: "Returned", value: counts.returned, icon: <RotateCcw size={19} /> },
  ];

  return (
    <>
      <PageHeading view="dashboard" action={<span className="kg-topbar-date"><CalendarDays size={17} aria-hidden="true" /> {new Date().toLocaleDateString(undefined, { dateStyle: "full" })}</span>} />
      <section aria-label="Inventory counts" className="kg-stat-grid">
        {stats.map((stat) => (
          <article className="kg-stat-card" key={stat.label}>
            <span className="kg-stat-icon" aria-hidden="true">{stat.icon}</span>
            <div><p className="kg-stat-label">{stat.label}</p><p className="kg-stat-value">{stat.value}</p></div>
          </article>
        ))}
      </section>
      <section className="kg-section" aria-labelledby="quick-actions-title">
        <div className="kg-section-heading"><div><h2 className="kg-section-title" id="quick-actions-title">Key operations</h2><p className="kg-section-note">Common actions for the office desk.</p></div></div>
        <div className="kg-action-row">
          <ActionLink to="/issue"><KeyRound size={17} aria-hidden="true" /> Issue a key</ActionLink>
          <ActionLink to="/return" variant="secondary"><RotateCcw size={17} aria-hidden="true" /> Return a key</ActionLink>
          <ActionLink to="/overdue" variant="outline"><AlertTriangle size={17} aria-hidden="true" /> View overdue</ActionLink>
        </div>
      </section>
      <section className="kg-section" aria-labelledby="overdue-preview-title">
        <div className="kg-section-heading">
          <div><h2 className="kg-section-title" id="overdue-preview-title">Overdue now</h2><p className="kg-section-note">The first three active records past their deadline.</p></div>
          <ActionLink to="/overdue" variant="outline">Full report <ArrowRight size={16} aria-hidden="true" /></ActionLink>
        </div>
        <OverdueTable transactions={overdue} />
      </section>
      <div className="kg-section">
        <Button type="button" variant="outline" size="sm" className="kg-button-touch" onClick={onReset}>
          <RotateCcw size={15} aria-hidden="true" /> Reset demo data
        </Button>
      </div>
    </>
  );
}

function RegisterPage({ service, onChanged, setNotice }: {
  service: KeyService;
  onChanged: () => void;
  setNotice: (notice: Notice | null) => void;
}) {
  const [keyId, setKeyId] = useState("");
  const [room, setRoom] = useState("");
  const [location, setLocation] = useState("");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const key = service.register_key(keyId, room, location);
      onChanged();
      setNotice({ kind: "success", text: `${key.key_id} was registered and is available.` });
      setKeyId("");
      setRoom("");
      setLocation("");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof KeyGuardError ? error.message : "The key could not be registered." });
    }
  };
  return (
    <>
      <PageHeading view="register" />
      <form className="kg-form" onSubmit={submit}>
        <div className="kg-field">
          <label className="kg-label" htmlFor="key-id">Key ID</label>
          <input className="kg-input" id="key-id" name="key_id" required maxLength={4} pattern="[Kk][0-9]{3}" placeholder="K107" value={keyId} onChange={(event) => setKeyId(event.target.value)} />
          <p className="kg-help">Use K followed by three digits. Input is saved in uppercase.</p>
        </div>
        <div className="kg-field">
          <label className="kg-label" htmlFor="room">Room</label>
          <input className="kg-input" id="room" name="room" required maxLength={80} placeholder="e.g. Faculty Room 3" value={room} onChange={(event) => setRoom(event.target.value)} />
        </div>
        <div className="kg-field">
          <label className="kg-label" htmlFor="location">Building / location</label>
          <input className="kg-input" id="location" name="location" required maxLength={80} placeholder="e.g. Block C" value={location} onChange={(event) => setLocation(event.target.value)} />
        </div>
        <div><Button type="submit" className="kg-button-touch"><Plus size={17} aria-hidden="true" /> Register key</Button></div>
      </form>
    </>
  );
}

function IssuePage({ service, onChanged, setNotice }: {
  service: KeyService;
  onChanged: () => void;
  setNotice: (notice: Notice | null) => void;
}) {
  const available = service.list_keys().filter((key) => key.status === "AVAILABLE");
  const [keyId, setKeyId] = useState(available[0]?.key_id ?? "");
  const [recipient, setRecipient] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [dueDate, setDueDate] = useState(() => localDateTimeValue(new Date(Date.now() + 60 * 60_000)));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const transaction = service.issue_key(keyId, recipient, recipientId, dueDate);
      onChanged();
      setNotice({ kind: "success", text: `${transaction.transaction_id} issued for ${transaction.key_id}.` });
      setRecipient("");
      setRecipientId("");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof KeyGuardError ? error.message : "The key could not be issued." });
    }
  };
  const noKeys = available.length === 0;
  return (
    <>
      <PageHeading view="issue" />
      {noKeys && <div className="kg-alert" role="status"><KeyRound size={18} aria-hidden="true" /><span>No keys are currently available to issue.</span></div>}
      <form className="kg-form" onSubmit={submit}>
        <div className="kg-field">
          <label className="kg-label" htmlFor="issue-key">Available key</label>
          <select className="kg-input" id="issue-key" name="key_id" required disabled={noKeys} value={keyId} onChange={(event) => setKeyId(event.target.value)}>
            {noKeys ? <option value="">No available keys</option> : available.map((key) => <option value={key.key_id} key={key.key_id}>{key.key_id} — {key.room} · {key.location}</option>)}
          </select>
        </div>
        <div className="kg-field">
          <label className="kg-label" htmlFor="recipient">Recipient name</label>
          <input className="kg-input" id="recipient" name="recipient" required maxLength={80} placeholder="Full name" disabled={noKeys} value={recipient} onChange={(event) => setRecipient(event.target.value)} />
        </div>
        <div className="kg-field">
          <label className="kg-label" htmlFor="recipient-id">Recipient ID</label>
          <input className="kg-input" id="recipient-id" name="recipient_id" required maxLength={30} placeholder="e.g. EMP101" disabled={noKeys} value={recipientId} onChange={(event) => setRecipientId(event.target.value)} />
        </div>
        <div className="kg-field">
          <label className="kg-label" htmlFor="due-date">Due date and time</label>
          <input className="kg-input" id="due-date" name="due_datetime" type="datetime-local" required min={localDateTimeValue(new Date())} disabled={noKeys} value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          <p className="kg-help">The key must be due back at a future time.</p>
        </div>
        <div><Button type="submit" className="kg-button-touch" disabled={noKeys}><KeyRound size={17} aria-hidden="true" /> Confirm issue</Button></div>
      </form>
    </>
  );
}

function ReturnPage({ service, onChanged, setNotice }: {
  service: KeyService;
  onChanged: () => void;
  setNotice: (notice: Notice | null) => void;
}) {
  const active = service.list_active_transactions();
  const [reference, setReference] = useState(active[0]?.transaction_id ?? "");
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const transaction = service.return_key(reference);
      onChanged();
      setNotice({ kind: "success", text: `${transaction.transaction_id} returned. ${transaction.key_id} is available again.` });
      setReference("");
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof KeyGuardError ? error.message : "The key could not be returned." });
    }
  };
  return (
    <>
      <PageHeading view="return" />
      {active.length === 0 ? (
        <EmptyState title="No active keys to return" detail="An active issue must exist before a key can be returned." />
      ) : (
        <form className="kg-form" onSubmit={submit}>
          <div className="kg-field">
            <label className="kg-label" htmlFor="return-reference">Active transaction</label>
            <select className="kg-input" id="return-reference" name="reference" required value={reference} onChange={(event) => setReference(event.target.value)}>
              {active.map((transaction) => (
                <option value={transaction.transaction_id} key={transaction.transaction_id}>
                  {transaction.transaction_id} — {transaction.key_id} — {transaction.recipient} — due {formatTime(transaction.due_date)}
                </option>
              ))}
            </select>
            <p className="kg-help">Only active issues are listed.</p>
          </div>
          <div><Button type="submit" className="kg-button-touch"><Check size={17} aria-hidden="true" /> Confirm return</Button></div>
        </form>
      )}
    </>
  );
}

function SearchPage({ service, searchTerm }: { service: KeyService; searchTerm: string }) {
  const [query, setQuery] = useState(searchTerm);
  const results = service.search(searchTerm);
  const keys = service.list_keys();
  return (
    <>
      <PageHeading view="search" />
      <form className="kg-search-form" action="/search" method="get" role="search">
        <label htmlFor="search-query" className="sr-only">Search keys and transactions</label>
        <input className="kg-input" id="search-query" type="search" name="q" placeholder="Key, room, recipient, ID, transaction or status" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Button type="submit" className="kg-button-touch"><Search size={17} aria-hidden="true" /> Search</Button>
      </form>
      {!searchTerm.trim() ? (
        <EmptyState title="Search the register" detail="Enter a key ID, room, recipient, ID, transaction, or status." />
      ) : (
        <>
          <section className="kg-section" aria-labelledby="search-keys-title">
            <div className="kg-section-heading"><div><h2 className="kg-section-title" id="search-keys-title">Keys</h2><p className="kg-section-note">{results.keys.length} match{results.keys.length === 1 ? "" : "es"}</p></div></div>
            <KeyTable keys={results.keys} />
          </section>
          <section className="kg-section" aria-labelledby="search-transactions-title">
            <div className="kg-section-heading"><div><h2 className="kg-section-title" id="search-transactions-title">Transactions</h2><p className="kg-section-note">{results.transactions.length} match{results.transactions.length === 1 ? "" : "es"}</p></div></div>
            {results.transactions.length ? <TransactionHistoryTable transactions={results.transactions} keys={keys} /> : <EmptyState title="No matching transactions" />}
          </section>
        </>
      )}
    </>
  );
}

function AuditList({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <EmptyState title="No office actions recorded" />;
  return (
    <div className="kg-audit-list">
      {events.map((event, index) => (
        <article className="kg-audit-row" key={`${event.timestamp}-${event.action}-${index}`}>
          <time className="kg-audit-date" dateTime={event.timestamp}>{formatDateTime(event.timestamp)}</time>
          <span className="kg-mono">{event.action.replaceAll("_", " ")}</span>
          <span>{event.description}<span className="kg-subline">{event.actor}</span></span>
        </article>
      ))}
    </div>
  );
}

function NoticeBanner({ notice }: { notice: Notice }) {
  return (
    <div className={`kg-alert kg-alert-${notice.kind}`} role="alert">
      {notice.kind === "success" ? <CircleCheck size={18} aria-hidden="true" /> : <AlertTriangle size={18} aria-hidden="true" />}
      <span>{notice.text}</span>
    </div>
  );
}

export function KeyguardApp({ view, searchTerm = "" }: KeyguardAppProps) {
  const [service, setService] = useState<KeyService | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    try {
      setService(new KeyService(window.localStorage));
    } catch {
      setLoadFailed(true);
    }
    const timer = window.setInterval(() => setRevision((current) => current + 1), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const changed = () => setRevision((current) => current + 1);
  const page = PAGE_DETAILS[view];

  if (loadFailed) {
    return <main className="kg-loading"><p>The demo register could not be opened in this browser.</p></main>;
  }
  if (!service) {
    return <main className="kg-loading" aria-live="polite"><p>Opening the KEYGUARD register…</p></main>;
  }
  void revision;

  const counts = service.get_dashboard_counts();
  const body = (() => {
    switch (view) {
      case "dashboard":
        return (
          <DashboardPage
            service={service}
            counts={counts}
            onReset={() => {
              if (window.confirm("Restore the fictional sample records? Current demo changes will be replaced.")) {
                service.reset_demo_data();
                changed();
                setNotice({ kind: "success", text: "Demo records were restored." });
              }
            }}
          />
        );
      case "keys":
        return <><PageHeading view="keys" action={<ActionLink to="/keys/register"><Plus size={17} aria-hidden="true" /> Register key</ActionLink>} /><KeyTable keys={service.list_keys()} /></>;
      case "register":
        return <RegisterPage service={service} onChanged={changed} setNotice={setNotice} />;
      case "issue":
        return <IssuePage service={service} onChanged={changed} setNotice={setNotice} />;
      case "return":
        return <ReturnPage service={service} onChanged={changed} setNotice={setNotice} />;
      case "issued":
        return <><PageHeading view="issued" /><ActiveTable transactions={service.list_active_transactions()} /></>;
      case "overdue":
        return <><PageHeading view="overdue" /><OverdueTable transactions={service.list_overdue()} /></>;
      case "due-soon":
        return <><PageHeading view="due-soon" /><DueSoonTable transactions={service.list_due_soon()} /></>;
      case "search":
        return <SearchPage service={service} searchTerm={searchTerm} />;
      case "history":
        return (
          <>
            <PageHeading view="history" />
            <section aria-labelledby="transaction-history-title">
              <div className="kg-section-heading"><div><h2 className="kg-section-title" id="transaction-history-title">Transactions</h2><p className="kg-section-note">Newest issues first.</p></div></div>
              <TransactionHistoryTable transactions={service.list_transactions()} keys={service.list_keys()} />
            </section>
            <section className="kg-section" aria-labelledby="audit-history-title">
              <div className="kg-section-heading"><div><h2 className="kg-section-title" id="audit-history-title">Office activity</h2><p className="kg-section-note">Successful registrations, issues, and returns.</p></div></div>
              <AuditList events={service.list_audit_events()} />
            </section>
          </>
        );
    }
  })();

  return (
    <div className="kg-layout">
      <Sidebar view={view} />
      <main className="kg-main">
        <div className="kg-topbar">
          <span className="kg-topbar-caption">KEYGUARD / {page.eyebrow}</span>
          <form className="kg-topbar-search" action="/search" method="get" role="search">
            <label className="sr-only" htmlFor="nav-search">Search the register</label>
            <Search size={16} aria-hidden="true" />
            <input id="nav-search" name="q" type="search" placeholder="Search records" />
          </form>
        </div>
        <div className="kg-content">
          {notice && <NoticeBanner notice={notice} />}
          {body}
          <footer className="kg-footer">Academic prototype - sample data only</footer>
        </div>
      </main>
    </div>
  );
}