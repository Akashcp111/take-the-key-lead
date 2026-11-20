import { describe, expect, it } from "vitest";

import {
  DuplicateKeyError,
  InvalidDueDateError,
  KeyNotFoundError,
  KeyUnavailableError,
  RecordNotFoundError,
} from "@/lib/keyguard-errors";
import { KeyService, type KeyTransaction } from "@/lib/keyguard-service";

const STORAGE_KEY = "keyguard.academic-demo.v1";
const NOW = new Date("2026-11-20T16:00:00.000Z");

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createService() {
  const storage = new MemoryStorage();
  return { storage, service: new KeyService(storage, NOW) };
}

describe("KeyService", () => {
  it("registers a normalized key and rejects a duplicate", () => {
    const { service } = createService();
    const key = service.register_key(" k107 ", "Studio 7", "Block D");

    expect(key.key_id).toBe("K107");
    expect(service.list_keys().at(-1)?.status).toBe("AVAILABLE");
    expect(() => service.register_key("K107", "Another room", "Block A")).toThrow(DuplicateKeyError);
  });

  it("issues an available key using the highest transaction ID plus one", () => {
    const { service } = createService();
    const transaction = service.issue_key("K104", "Rahul Sharma", "EMP101", new Date(NOW.getTime() + 3_600_000), NOW);

    expect(transaction.transaction_id).toBe("TX0004");
    expect(service.list_keys().find((key) => key.key_id === "K104")?.status).toBe("ISSUED");
    expect(() => service.issue_key("K104", "Anita Rao", "STU204", new Date(NOW.getTime() + 3_600_000), NOW)).toThrow(KeyUnavailableError);
    expect(() => service.issue_key("K999", "Anita Rao", "STU204", new Date(NOW.getTime() + 3_600_000), NOW)).toThrow(KeyNotFoundError);
  });

  it("rejects due times equal to or before now", () => {
    const { service } = createService();
    const dueNow = new Date(NOW);
    const dueEarlier = new Date(NOW.getTime() - 1);

    expect(() => service.issue_key("K104", "Mina Shah", "STU100", dueNow, NOW)).toThrow(InvalidDueDateError);
    expect(() => service.issue_key("K104", "Mina Shah", "STU100", dueEarlier, NOW)).toThrow(InvalidDueDateError);
    expect(service.list_keys().find((key) => key.key_id === "K104")?.status).toBe("AVAILABLE");
  });

  it("returns an active issue by transaction ID or key ID", () => {
    const byTransaction = createService().service;
    const first = byTransaction.return_key("TX0001", NOW);
    expect(first.status).toBe("RETURNED");
    expect(first.return_date).toBe(NOW.toISOString());
    expect(byTransaction.list_keys().find((key) => key.key_id === "K101")?.status).toBe("AVAILABLE");

    const byKey = createService().service;
    expect(byKey.return_key("k101", NOW).transaction_id).toBe("TX0001");
    expect(() => byKey.return_key("TX0001", NOW)).toThrow(RecordNotFoundError);
    expect(() => byKey.return_key("K999", NOW)).toThrow(RecordNotFoundError);
  });

  it("lists only active overdue transactions and uses strict deadline boundaries", () => {
    const { service, storage } = createService();
    expect(service.list_overdue(NOW).map((transaction) => transaction.transaction_id)).toEqual(["TX0001"]);

    service.issue_key("K104", "Asha Iyer", "STU301", new Date(NOW.getTime() + 60_000), NOW);
    service.issue_key("K105", "Dev Mehta", "EMP204", new Date(NOW.getTime() + 60_000), NOW);
    service.issue_key("K106", "Noor Ali", "STU312", new Date(NOW.getTime() + 60_000), NOW);
    const saved = storage.getItem(STORAGE_KEY);
    if (!saved) throw new Error("Expected sample data to be stored.");
    const data = JSON.parse(saved) as { transactions: KeyTransaction[] };
    const exactNow = data.transactions.find((transaction) => transaction.key_id === "K104");
    const exactThirty = data.transactions.find((transaction) => transaction.key_id === "K105");
    const exactThirtyOne = data.transactions.find((transaction) => transaction.key_id === "K106");
    if (!exactNow || !exactThirty || !exactThirtyOne) throw new Error("Expected all boundary transactions.");
    exactNow.due_date = NOW.toISOString();
    exactThirty.due_date = new Date(NOW.getTime() + 30 * 60_000).toISOString();
    exactThirtyOne.due_date = new Date(NOW.getTime() + 31 * 60_000).toISOString();
    storage.setItem(STORAGE_KEY, JSON.stringify(data));

    const boundaryService = new KeyService(storage, NOW);
    expect(boundaryService.list_overdue(NOW).some((transaction) => transaction.key_id === "K104")).toBe(false);
    expect(boundaryService.list_due_soon(NOW).map((transaction) => transaction.key_id)).toEqual(["K104", "K102", "K105"]);
    expect(boundaryService.list_due_soon(NOW).some((transaction) => transaction.key_id === "K106")).toBe(false);
  });

  it("searches case-insensitively without changing stored data", () => {
    const { service, storage } = createService();
    const before = storage.getItem(STORAGE_KEY);

    expect(service.search("computer lab").keys[0]?.key_id).toBe("K101");
    expect(service.search("rah").transactions[0]?.recipient).toBe("Rahul Sharma");
    expect(service.search("tx0001").transactions[0]?.transaction_id).toBe("TX0001");
    expect(storage.getItem(STORAGE_KEY)).toBe(before);
  });

  it("preserves changes after reloading and appends an audit event per successful action", () => {
    const { service, storage } = createService();
    const initialEvents = service.list_audit_events().length;
    service.register_key("K107", "Faculty Room 3", "Block C");
    service.issue_key("K104", "Sam Lee", "EMP310", new Date(NOW.getTime() + 45 * 60_000), NOW);
    service.return_key("K104", NOW);

    const reloaded = new KeyService(storage, NOW);
    expect(reloaded.list_keys().some((key) => key.key_id === "K107")).toBe(true);
    expect(reloaded.list_transactions().find((transaction) => transaction.transaction_id === "TX0004")?.status).toBe("RETURNED");
    expect(reloaded.list_audit_events()).toHaveLength(initialEvents + 3);
  });
});