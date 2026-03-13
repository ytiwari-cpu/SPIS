# SPIS IAM — Keycloak Infrastructure Migration

> **Date:** February 24, 2026
> **Scope:** Keycloak migrated from local H2 to shared Supabase PostgreSQL via Connection Pooler
> **Status:** ✅ Complete and verified

---

## Executive Summary

All developers now share **one Keycloak database** in Supabase. No sync scripts. No manual imports. When Developer A resets a password, Developer B's Keycloak sees it immediately.

### Architecture

```
Developer A's PC              Developer B's PC
┌─────────────────┐          ┌─────────────────┐
│ Keycloak (Docker)│          │ Keycloak (Docker)│
│ port 8080        │          │ port 8080        │
└────────┬────────┘          └────────┬────────┘
         │  JDBC (IPv4)               │  JDBC (IPv4)
         └───────────┬────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │  Supabase Connection Pooler (IPv4) │
     │  aws-1-ap-northeast-1.pooler...    │
     │  Port 5432 (Session Mode)          │
     └───────────────┬───────────────────┘
                     ↓
     ┌───────────────────────────────────┐
     │    Supabase IAM PostgreSQL         │
     │  schema: public   → app tables     │
     │  schema: keycloak → 92 KC tables   │
     └───────────────────────────────────┘
```

### Key Facts

| Item | Value |
|------|-------|
| Pooler Host | `aws-1-ap-northeast-1.pooler.supabase.com` |
| Pooler Port | `5432` (session mode) |
| Pooler User | `postgres.wrxrstmncezssrscrkxs` |
| Keycloak Schema | `keycloak` (92 tables) |
| App Schema | `public` (unchanged) |
| First Boot | ~10 min (creates 92 tables over network) |
| Warm Restart | ~60s |

---

## The IPv6 Problem & Solution

The direct Supabase DB hostname (`db.wrxrstmncezssrscrkxs.supabase.co`) resolves to **IPv6 only**. Our network has no IPv6 routing. Keycloak's JVM needs JDBC (direct PostgreSQL), not REST.

**Solution:** Supabase's **Connection Pooler** (`aws-1-ap-northeast-1.pooler.supabase.com`) resolves to IPv4 (`18.176.230.146`). It proxies connections to the IPv6-only database server. Keycloak connects to the pooler via IPv4 JDBC, and it works.

---

## What Changed

### `start-infra.sh`
- Keycloak now uses `KC_DB=postgres` with the Connection Pooler URL
- No sync script. No proxy. No socat.
- First boot timeout increased to 750s (schema creation over network is slow)

### `setup-keycloak.mjs`
- Short-circuit now checks both realm AND client exist (not just realm)
- Updated info messages to reflect shared architecture

### `sync-users-to-keycloak.mjs`
- Marked `@deprecated` — no longer called by `start-infra.sh`
- Kept for emergency migration use only

### Previously Removed (still clean)
- `password_hash` / `keycloak_username` columns — dropped from Supabase
- `bcrypt` imports in crypto.ts, login.ts — removed
- `savePasswordHash` function in repository.ts — removed
- Hash saving in passwordReset.ts — removed

---

## Developer Workflow

```bash
# First time (or after Docker prune):
bash start-infra.sh        # ~10 min first boot, creates 92 tables
                            # Realm + client + roles auto-configured

# Every subsequent time:
bash start-infra.sh        # ~60s warm restart, setup skips (idempotent)

# Stop:
bash stop-all.sh
```

No sync. No manual steps. Just start and go.
