# KEYGUARD — Room Key Issue Register

An academic prototype for recording room-key issues and returns, with live overdue and due-soon reports. All names and records are fictional. No login, institutional records, or live services are used.

## Run the prototype

This project runs in the provided Lovable preview. For local development, install the project dependencies and start the development server:

```sh
bun install
bun run dev
```

The key register is saved in this browser on this device. Refreshing or reopening the preview keeps changes; use **Reset demo data** on the dashboard to restore the sample register.

## Checks

```sh
bun run test
```

## Manual demo checklist

1. Open the dashboard and review the six counts.
2. Open **Overdue** and confirm K101 is listed.
3. Register K107.
4. Issue K104 to a recipient with a future due time.
5. Open **Issued** and confirm the new transaction appears.
6. Return the key using its transaction ID.
7. Reopen **Overdue** and confirm the report remains available.
8. Search for K104 or the recipient.
9. Open **History** and confirm the issue and return entries.
10. Refresh or reopen the preview and confirm the register persists.

## Assumptions

- This preview uses the project's supported React app and browser storage instead of a Python/Flask server, keeping the demo self-contained and offline-friendly.
- Saved records belong to the current browser and are not shared across devices.
- Resetting the demo replaces the current local records with the fictional sample set.