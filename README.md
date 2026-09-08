# Water Track

A local-only Expo app for iOS and Android. Data is stored in `water-track.db` on the device using expo-sqlite and Drizzle ORM. No account, API, server, or cloud sync is needed.

## Run

Use Node.js 22.13+ (Node 24 LTS recommended) and pnpm 11.18.0.

```sh
pnpm install
pnpm start --clear
```

Open in Expo Go on a compatible device, or use `pnpm ios` / `pnpm android` with a simulator. Restart Metro with `--clear` after changing Babel or migration bundling configuration. This setup targets native platforms; browser SQLite support is not configured.

## Test persistence

1. On Home, tap **Add a glass** several times.
2. Fully close and reopen the app. The count should remain.
3. Try **Remove one** and **Reset**, then reopen again. The count cannot go below zero.
4. An installed standalone build can run offline. Expo Go development still needs access to Metro to load the app bundle.

The counter is a simple all-time total, not a daily log. Uninstalling the app or clearing its storage removes the local database. There is no application-level backup or sync.

## Database changes

Edit `src/db/schema.ts`, then run:

```sh
pnpm db:generate
pnpm db:check
```

Commit the generated `drizzle/` directory, including SQL, snapshots, journal, and `migrations.js`. Drizzle Kit generates migrations during development; the app applies pending migrations on startup before rendering its screens. The initial counter is inserted only if missing, so reopening the app does not reset it. Failed initialization goes to the router error boundary.

`src/db/provider.tsx` owns the SQLite connection and exposes `useDatabase()`. SQLite change notifications drive Drizzle live queries. Counter updates use SQL arithmetic to avoid losing rapid taps. Babel inlines migration SQL and Metro recognizes `.sql` files. `pnpm-workspace.yaml` allows esbuild's install scripts for Drizzle Kit.

```sh
pnpm typecheck
pnpm lint
```
