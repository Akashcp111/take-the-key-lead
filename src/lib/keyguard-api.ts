import {
  DuplicateKeyError,
  InvalidDueDateError,
  KeyGuardError,
  KeyNotFoundError,
  KeyUnavailableError,
  RecordNotFoundError,
  ValidationError,
} from "@/lib/keyguard-errors";
import {
  KeyService,
  type ActiveTransaction,
  type AuditEvent,
  type DashboardCounts,
  type DueSoonTransaction,
  type KeyRecord,
  type KeyTransaction,
  type OverdueTransaction,
  type SearchResults,
} from "@/lib/keyguard-service";

const API_BASE = "/api";

export interface RegisterState {
  counts: DashboardCounts;
  keys: KeyRecord[];
  active: ActiveTransaction[];
  overdue: OverdueTransaction[];
  due_soon: DueSoonTransaction[];
  transactions: KeyTransaction[];
  audit_events: AuditEvent[];
  search: SearchResults;
}

const ERRORS: Record<string, new (message: string) => KeyGuardError> = {
  DuplicateKeyError,
  InvalidDueDateError,
  KeyNotFoundError,
  KeyUnavailableError,
  RecordNotFoundError,
  ValidationError,
};

let localServiceInstance: KeyService | null = null;
function getLocalService(): KeyService {
  if (!localServiceInstance) {
    const memoryStorage: Storage = typeof window !== "undefined" && window.localStorage
      ? window.localStorage
      : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
          clear: () => {},
          key: () => null,
          length: 0,
        };
    localServiceInstance = new KeyService(memoryStorage);
  }
  return localServiceInstance;
}

let backendStatus: "connected" | "local" = "local";
const statusListeners = new Set<(status: "connected" | "local") => void>();

export function getBackendStatus(): "connected" | "local" {
  return backendStatus;
}

export function subscribeBackendStatus(listener: (status: "connected" | "local") => void): () => void {
  statusListeners.add(listener);
  listener(backendStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

function updateBackendStatus(status: "connected" | "local") {
  if (backendStatus !== status) {
    backendStatus = status;
    statusListeners.forEach((l) => l(status));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
    updateBackendStatus("connected");
  } catch (err) {
    updateBackendStatus("local");
    throw err;
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const record =
      body && typeof body === "object" ? (body as { error?: unknown; code?: unknown }) : {};
    const message =
      typeof record.error === "string" ? record.error : "The request could not be completed.";
    const code = typeof record.code === "string" ? record.code : "";
    const ErrorType = ERRORS[code] ?? KeyGuardError;
    throw new ErrorType(message);
  }
  return body as T;
}

function getLocalState(searchTerm = ""): RegisterState {
  const service = getLocalService();
  const now = new Date();
  return {
    counts: service.get_dashboard_counts(now),
    keys: service.list_keys(),
    active: service.list_active_transactions(now),
    overdue: service.list_overdue(now),
    due_soon: service.list_due_soon(now),
    transactions: service.list_transactions(),
    audit_events: service.list_audit_events(),
    search: searchTerm ? service.search(searchTerm, now) : { keys: [], transactions: [] },
  };
}

export async function fetchState(searchTerm = ""): Promise<RegisterState> {
  const query = searchTerm.trim();
  const path = query ? `/state?q=${encodeURIComponent(query)}` : "/state";
  try {
    return await request<RegisterState>(path);
  } catch {
    // Graceful fallback to local mock store when backend isn't responding yet
    return getLocalState(searchTerm);
  }
}

export async function registerKey(keyId: string, room: string, location: string): Promise<KeyRecord> {
  try {
    return await request<KeyRecord>("/keys", {
      method: "POST",
      body: JSON.stringify({ key_id: keyId, room, location }),
    });
  } catch (err) {
    if (backendStatus === "connected") throw err;
    return getLocalService().register_key(keyId, room, location);
  }
}

export async function issueKey(
  keyId: string,
  recipient: string,
  recipientId: string,
  dueDatetime: string,
): Promise<KeyTransaction> {
  try {
    return await request<KeyTransaction>("/issue", {
      method: "POST",
      body: JSON.stringify({
        key_id: keyId,
        recipient,
        recipient_id: recipientId,
        due_datetime: dueDatetime,
      }),
    });
  } catch (err) {
    if (backendStatus === "connected") throw err;
    return getLocalService().issue_key(keyId, recipient, recipientId, dueDatetime);
  }
}

export async function returnKey(reference: string): Promise<KeyTransaction> {
  try {
    return await request<KeyTransaction>("/return", {
      method: "POST",
      body: JSON.stringify({ reference }),
    });
  } catch (err) {
    if (backendStatus === "connected") throw err;
    return getLocalService().return_key(reference);
  }
}

export async function resetDemo(): Promise<RegisterState> {
  try {
    return await request<RegisterState>("/reset", { method: "POST" });
  } catch (err) {
    if (backendStatus === "connected") throw err;
    getLocalService().reset_demo_data();
    return getLocalState();
  }
}
