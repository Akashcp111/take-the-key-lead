import {
  DuplicateKeyError,
  InvalidDueDateError,
  KeyNotFoundError,
  KeyUnavailableError,
  RecordNotFoundError,
  ValidationError,
} from "@/lib/keyguard-errors";

export type KeyStatus = "AVAILABLE" | "ISSUED";
export type TransactionStatus = "ISSUED" | "RETURNED";
export type ActiveStatus = "ISSUED" | "DUE SOON" | "OVERDUE";
export type AuditAction = "KEY_REGISTERED" | "KEY_ISSUED" | "KEY_RETURNED";

export interface KeyRecord {
  key_id: string;
  room: string;
  location: string;
  status: KeyStatus;
  registered_at: string;
}

export interface KeyTransaction {
  transaction_id: string;
  key_id: string;
  recipient: string;
  recipient_id: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status: TransactionStatus;
}

export interface AuditEvent {
  timestamp: string;
  actor: "Office Administrator";
  action: AuditAction;
  description: string;
}

export interface ActiveTransaction extends Omit<KeyTransaction, "status"> {
  status: ActiveStatus;
  room: string;
  location: string;
}

export interface OverdueTransaction extends ActiveTransaction {
  overdue_minutes: number;
}

export interface DueSoonTransaction extends ActiveTransaction {
  minutes_remaining: number;
}

export interface SearchResults {
  keys: KeyRecord[];
  transactions: Array<KeyTransaction & { room: string; location: string; display_status: string }>;
}

interface StoreData {
  keys: KeyRecord[];
  transactions: KeyTransaction[];
  audit_events: AuditEvent[];
}

export interface DashboardCounts {
  total: number;
  available: number;
  issued: number;
  overdue: number;
  due_soon: number;
  returned: number;
}

const STORAGE_KEY = "keyguard.academic-demo.v1";

function isStoreData(value: unknown): value is StoreData {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record["keys"]) &&
    Array.isArray(record["transactions"]) &&
    Array.isArray(record["audit_events"])
  );
}

function plusMinutes(date: Date, minutes: number): string {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function seedData(now: Date): StoreData {
  const at = (offsetDays: number) => new Date(now.getTime() + offsetDays * 86_400_000).toISOString();
  const keys: KeyRecord[] = [
    { key_id: "K101", room: "Computer Lab 1", location: "Block A", status: "ISSUED", registered_at: at(-30) },
    { key_id: "K102", room: "Cyber Security Lab", location: "Block B", status: "ISSUED", registered_at: at(-26) },
    { key_id: "K103", room: "Seminar Hall", location: "Block A", status: "AVAILABLE", registered_at: at(-22) },
    { key_id: "K104", room: "Faculty Room 2", location: "Block C", status: "AVAILABLE", registered_at: at(-18) },
    { key_id: "K105", room: "Network Lab", location: "Block B", status: "AVAILABLE", registered_at: at(-14) },
    { key_id: "K106", room: "Conference Room", location: "Block A", status: "AVAILABLE", registered_at: at(-10) },
  ];
  const transactions: KeyTransaction[] = [
    {
      transaction_id: "TX0001",
      key_id: "K101",
      recipient: "Rahul Sharma",
      recipient_id: "EMP101",
      issue_date: at(-1),
      due_date: plusMinutes(now, -120),
      return_date: null,
      status: "ISSUED",
    },
    {
      transaction_id: "TX0002",
      key_id: "K102",
      recipient: "Anita Rao",
      recipient_id: "STU204",
      issue_date: plusMinutes(now, -45),
      due_date: plusMinutes(now, 20),
      return_date: null,
      status: "ISSUED",
    },
    {
      transaction_id: "TX0003",
      key_id: "K103",
      recipient: "Maya Patel",
      recipient_id: "STU118",
      issue_date: at(-3),
      due_date: at(-2),
      return_date: at(-2),
      status: "RETURNED",
    },
  ];
  const audit_events: AuditEvent[] = [
    ...keys.map((key, index) => ({
      timestamp: at(-30 + index * 4),
      actor: "Office Administrator" as const,
      action: "KEY_REGISTERED" as const,
      description: `Registered ${key.key_id} for ${key.room}`,
    })),
    {
      timestamp: transactions[0]?.issue_date ?? now.toISOString(),
      actor: "Office Administrator",
      action: "KEY_ISSUED",
      description: "Issued K101 to Rahul Sharma (EMP101)",
    },
    {
      timestamp: transactions[1]?.issue_date ?? now.toISOString(),
      actor: "Office Administrator",
      action: "KEY_ISSUED",
      description: "Issued K102 to Anita Rao (STU204)",
    },
    {
      timestamp: transactions[2]?.return_date ?? now.toISOString(),
      actor: "Office Administrator",
      action: "KEY_RETURNED",
      description: "Returned K103 from Maya Patel (STU118)",
    },
  ];
  return { keys, transactions, audit_events };
}

function sortedNewest<T>(records: T[], readDate: (record: T) => string): T[] {
  return [...records].sort((left, right) => readDate(right).localeCompare(readDate(left)));
}

export class KeyService {
  private data: StoreData;

  constructor(
    private readonly storage: Pick<Storage, "getItem" | "setItem">,
    now: Date = new Date(),
  ) {
    const saved = storage.getItem(STORAGE_KEY);
    let loaded: StoreData | null = null;
    if (saved) {
      try {
        const parsed: unknown = JSON.parse(saved);
        if (isStoreData(parsed)) loaded = parsed;
      } catch {
        loaded = null;
      }
    }
    this.data = loaded ?? seedData(now);
    if (!loaded) this.persist(this.data);
  }

  get_dashboard_counts(now: Date = new Date()): DashboardCounts {
    const active = this.list_active_transactions(now);
    return {
      total: this.data.keys.length,
      available: this.data.keys.filter((key) => key.status === "AVAILABLE").length,
      issued: active.length,
      overdue: active.filter((transaction) => transaction.status === "OVERDUE").length,
      due_soon: active.filter((transaction) => transaction.status === "DUE SOON").length,
      returned: this.data.transactions.filter((transaction) => transaction.status === "RETURNED").length,
    };
  }

  list_keys(): KeyRecord[] {
    return this.data.keys.map((key) => ({ ...key }));
  }

  register_key(keyId: string, room: string, location: string): KeyRecord {
    const normalizedId = keyId.trim().toUpperCase();
    const cleanRoom = room.trim();
    const cleanLocation = location.trim();
    if (!/^K\d{3}$/.test(normalizedId)) {
      throw new ValidationError("Key ID must use the format K followed by 3 digits.");
    }
    if (!cleanRoom || !cleanLocation) {
      throw new ValidationError("Enter both a room name and a location.");
    }
    if (this.data.keys.some((key) => key.key_id === normalizedId)) {
      throw new DuplicateKeyError(`${normalizedId} is already registered.`);
    }

    const registered: KeyRecord = {
      key_id: normalizedId,
      room: cleanRoom,
      location: cleanLocation,
      status: "AVAILABLE",
      registered_at: new Date().toISOString(),
    };
    this.persist({
      ...this.data,
      keys: [...this.data.keys, registered],
      audit_events: [
        ...this.data.audit_events,
        this.audit("KEY_REGISTERED", `Registered ${normalizedId} for ${cleanRoom}`),
      ],
    });
    return { ...registered };
  }

  issue_key(
    keyId: string,
    recipient: string,
    recipientId: string,
    dueDatetime: string | Date,
    now: Date = new Date(),
  ): KeyTransaction {
    const normalizedId = keyId.trim().toUpperCase();
    const key = this.data.keys.find((candidate) => candidate.key_id === normalizedId);
    if (!key) throw new KeyNotFoundError(`Key ${normalizedId || ""} was not found.`);
    if (key.status !== "AVAILABLE") {
      throw new KeyUnavailableError(`${normalizedId} is already issued and cannot be issued again.`);
    }

    const cleanRecipient = recipient.trim();
    const cleanRecipientId = recipientId.trim();
    if (!cleanRecipient || !cleanRecipientId) {
      throw new ValidationError("Enter the recipient's name and ID.");
    }
    const dueDate = dueDatetime instanceof Date ? new Date(dueDatetime.getTime()) : new Date(dueDatetime);
    if (Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= now.getTime()) {
      throw new InvalidDueDateError("The due date and time must be later than now.");
    }

    const transaction: KeyTransaction = {
      transaction_id: this.nextTransactionId(),
      key_id: normalizedId,
      recipient: cleanRecipient,
      recipient_id: cleanRecipientId,
      issue_date: now.toISOString(),
      due_date: dueDate.toISOString(),
      return_date: null,
      status: "ISSUED",
    };
    const nextKeys = this.data.keys.map((candidate) =>
      candidate.key_id === normalizedId ? { ...candidate, status: "ISSUED" as const } : candidate,
    );
    this.persist({
      ...this.data,
      keys: nextKeys,
      transactions: [...this.data.transactions, transaction],
      audit_events: [
        ...this.data.audit_events,
        this.audit("KEY_ISSUED", `Issued ${normalizedId} to ${cleanRecipient} (${cleanRecipientId})`, now),
      ],
    });
    return { ...transaction };
  }

  return_key(reference: string, now: Date = new Date()): KeyTransaction {
    const normalizedReference = reference.trim().toUpperCase();
    if (!normalizedReference) throw new RecordNotFoundError("Choose an active transaction to return.");
    const exactTransaction = this.data.transactions.find(
      (transaction) => transaction.transaction_id.toUpperCase() === normalizedReference,
    );
    if (exactTransaction?.status === "RETURNED") {
      throw new RecordNotFoundError(`${exactTransaction.transaction_id} has already been returned.`);
    }
    const active = exactTransaction ?? this.data.transactions.find(
      (transaction) => transaction.key_id === normalizedReference && transaction.status === "ISSUED",
    );
    if (!active || active.status !== "ISSUED") {
      throw new RecordNotFoundError(`No active transaction matches ${normalizedReference}.`);
    }
    const key = this.data.keys.find((candidate) => candidate.key_id === active.key_id);
    if (!key) throw new KeyNotFoundError(`Key ${active.key_id} was not found.`);
    if (key.status !== "ISSUED") {
      throw new ValidationError(`${active.key_id} has an inconsistent issue record and was not changed.`);
    }

    const returned: KeyTransaction = { ...active, status: "RETURNED", return_date: now.toISOString() };
    this.persist({
      ...this.data,
      keys: this.data.keys.map((candidate) =>
        candidate.key_id === key.key_id ? { ...candidate, status: "AVAILABLE" as const } : candidate,
      ),
      transactions: this.data.transactions.map((transaction) =>
        transaction.transaction_id === active.transaction_id ? returned : transaction,
      ),
      audit_events: [
        ...this.data.audit_events,
        this.audit("KEY_RETURNED", `Returned ${key.key_id} from ${active.recipient} (${active.recipient_id})`, now),
      ],
    });
    return { ...returned };
  }

  list_active_transactions(now: Date = new Date()): ActiveTransaction[] {
    return this.data.transactions
      .filter((transaction) => transaction.status === "ISSUED")
      .map((transaction) => {
        const key = this.data.keys.find((candidate) => candidate.key_id === transaction.key_id);
        const dueTime = new Date(transaction.due_date).getTime();
        const status: ActiveStatus = dueTime < now.getTime()
          ? "OVERDUE"
          : dueTime <= now.getTime() + 30 * 60_000
            ? "DUE SOON"
            : "ISSUED";
        return {
          ...transaction,
          status,
          room: key?.room ?? "Unknown room",
          location: key?.location ?? "",
        };
      })
      .sort((left, right) => left.due_date.localeCompare(right.due_date));
  }

  list_overdue(now: Date = new Date()): OverdueTransaction[] {
    return this.list_active_transactions(now)
      .filter((transaction) => transaction.status === "OVERDUE")
      .map((transaction) => ({
        ...transaction,
        overdue_minutes: Math.floor((now.getTime() - new Date(transaction.due_date).getTime()) / 60_000),
      }));
  }

  list_due_soon(now: Date = new Date(), minutes = 30): DueSoonTransaction[] {
    const latestTime = now.getTime() + minutes * 60_000;
    return this.list_active_transactions(now)
      .filter((transaction) => {
        const dueTime = new Date(transaction.due_date).getTime();
        return dueTime >= now.getTime() && dueTime <= latestTime;
      })
      .map((transaction) => ({
        ...transaction,
        minutes_remaining: Math.ceil((new Date(transaction.due_date).getTime() - now.getTime()) / 60_000),
      }));
  }

  search(term: string): SearchResults {
    const query = term.trim().toLocaleLowerCase();
    if (!query) return { keys: [], transactions: [] };
    const activeStatuses = new Map(
      this.list_active_transactions().map((transaction) => [transaction.transaction_id, transaction.status]),
    );
    return {
      keys: this.list_keys().filter((key) =>
        [key.key_id, key.room, key.location, key.status].some((value) => value.toLocaleLowerCase().includes(query)),
      ),
      transactions: this.list_transactions().filter((transaction) => {
        const key = this.data.keys.find((candidate) => candidate.key_id === transaction.key_id);
        const values = [
          transaction.transaction_id,
          transaction.key_id,
          transaction.recipient,
          transaction.recipient_id,
          transaction.status,
          activeStatuses.get(transaction.transaction_id) ?? "",
          key?.room ?? "",
          key?.location ?? "",
        ];
        return values.some((value) => value.toLocaleLowerCase().includes(query));
      }).map((transaction) => {
        const key = this.data.keys.find((candidate) => candidate.key_id === transaction.key_id);
        return {
          ...transaction,
          room: key?.room ?? "Unknown room",
          location: key?.location ?? "",
          display_status: activeStatuses.get(transaction.transaction_id) ?? transaction.status,
        };
      }),
    };
  }

  list_transactions(): KeyTransaction[] {
    return sortedNewest(this.data.transactions, (transaction) => transaction.issue_date).map((transaction) => ({ ...transaction }));
  }

  list_audit_events(): AuditEvent[] {
    return sortedNewest(this.data.audit_events, (event) => event.timestamp).map((event) => ({ ...event }));
  }

  reset_demo_data(now: Date = new Date()): void {
    this.persist(seedData(now));
  }

  private nextTransactionId(): string {
    const highest = this.data.transactions.reduce((max, transaction) => {
      const match = /^TX(\d+)$/.exec(transaction.transaction_id);
      const number = match?.[1] ? Number(match[1]) : 0;
      return Math.max(max, number);
    }, 0);
    return `TX${String(highest + 1).padStart(4, "0")}`;
  }

  private audit(action: AuditAction, description: string, timestamp: Date = new Date()): AuditEvent {
    return { timestamp: timestamp.toISOString(), actor: "Office Administrator", action, description };
  }

  private persist(next: StoreData): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(next));
    this.data = next;
  }
}