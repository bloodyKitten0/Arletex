# WhatsApp GoWA Integration Specification

## 1. Overview & Architecture

The Arletex WhatsApp Communication Adapter enables direct, authenticated two-way messaging between Proof and Arle over WhatsApp. Rather than relying on cloud proxies, closed-source reverse-engineered daemons, or unverified Node libraries, Arletex integrates with **GoWA (`go-whatsapp-web-multidevice`)**, a hardened Go-based daemon running strictly as an isolated local service on loopback.

```
+-----------------------------------------------------------------------------------+
|                           Mobile Device (WhatsApp Client)                         |
|                             Proof's Authorized Phone                              |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | End-to-End Encrypted Signal Protocol
                                          v
+-----------------------------------------------------------------------------------+
|              GoWA Local Service (127.0.0.1:3000 / loopback daemon)               |
|  - Manages WhatsApp Web multi-device session                                      |
|  - Webhook dispatch with HMAC-SHA256 signature header                             |
|  - Outbound message REST API endpoints                                            |
+-----------------------------------------+-----------------------------------------+
                                          |
                        Loopback REST     | Webhook (X-Hub-Signature-256)
                                          v
+-----------------------------------------------------------------------------------+
|             Arletex Desktop Backend (127.0.0.1:39281 / server.ts)                |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |                 WhatsAppAdapter (@arletex/core)                             |  |
|  |  - Strict Loopback Binding Enforcement (127.0.0.1 / localhost only)          |  |
|  |  - Constant-Time HMAC-SHA256 Verification (crypto.timingSafeEqual)           |  |
|  |  - Owner-Only Authorization Filter (ownerJid matches exactly)               |  |
|  |  - Prompt-Injection Boundary Protection (untrustedInput: true)              |  |
|  |  - Persistent SQLite Deduplication (Migration 066 whatsapp_deduplication)   |  |
|  |  - Outbound Send Pipeline with Exponential Backoff Retries                   |  |
|  +-------------------------------------+---------------------------------------+  |
|                                        |                                          |
|                                        v                                          |
|  +-----------------------------------------------------------------------------+  |
|  |           CognitiveControlBus -> APE Psychological Pipeline                 |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

---

## 2. Security Boundaries & Fail-Closed Policies

### 2.1 Loopback Isolation

The adapter strictly refuses any GoWA base URL that resolves outside `127.0.0.1` or `localhost`. Cloud webhook URLs or remote IP addresses are rejected at configuration time with a fail-closed exception.

### 2.2 Constant-Time HMAC Signature Verification

Every inbound webhook from GoWA is verified using `crypto.timingSafeEqual` with HMAC-SHA256. If the signature is missing, malformed, or invalid, the webhook is immediately dropped (HTTP 401) with an audit entry in `AuditRepository`.

### 2.3 Strict Owner-Only Access

Arle exclusively accepts instructions from her equal partner Proof:

- The configured `ownerJid` (e.g. `1234567890@s.whatsapp.net`) is enforced as an invariant.
- Messages from unknown contacts, group chats, or third-party senders are dropped and logged as unauthorized events.

### 2.4 Prompt-Injection Barrier

Inbound WhatsApp messages are treated as external, untrusted input:

- The adapter attaches `{ untrustedInput: true, channel: 'whatsapp', origin: 'external_communication' }` to the cognitive bus envelope.
- System-level privilege escalation, tool execution overrides, and bypass attempts contained in WhatsApp messages cannot override core psychological invariants or permission policies.

### 2.5 Deduplication & Database Persistence

To prevent duplicate processing caused by network retries or WhatsApp delivery receipts:

- All inbound message IDs are recorded atomically in SQLite table `whatsapp_deduplication` (Migration 066).
- If a message ID has already been processed within the retention window, it is acknowledged and ignored.

---

## 3. Database Schema (Migration 066)

```sql
-- Inbound message deduplication
CREATE TABLE IF NOT EXISTS whatsapp_deduplication (
  message_id TEXT PRIMARY KEY,
  sender_jid TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT NOT NULL
);

-- Outbound audit and rate-limiting log
CREATE TABLE IF NOT EXISTS whatsapp_outbound_audit (
  id TEXT PRIMARY KEY,
  recipient_jid TEXT NOT NULL,
  message_content TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_dedup_time ON whatsapp_deduplication(received_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_outbound_time ON whatsapp_outbound_audit(sent_at);
```

---

## 4. REST API Routes (`server.ts`)

| Route                      | Method | Purpose                                                                           |
| :------------------------- | :----: | :-------------------------------------------------------------------------------- |
| `/api/whatsapp/status`     | `GET`  | Returns live status: `enabled`, `connected`, `paired`, `ownerJid`, `endpointUrl`. |
| `/api/whatsapp/configure`  | `POST` | Updates adapter configuration (endpoint URL, owner JID, HMAC webhook secret).     |
| `/api/whatsapp/webhook`    | `POST` | Authenticated webhook receiving inbound messages from GoWA.                       |
| `/api/whatsapp/send`       | `POST` | Sends outbound text messages to Proof over WhatsApp.                              |
| `/api/whatsapp/pair`       | `POST` | Initiates pairing with GoWA; returns pairing code or QR URI.                      |
| `/api/whatsapp/disconnect` | `POST` | Disconnects the current WhatsApp session cleanly.                                 |
| `/api/whatsapp/toggle`     | `POST` | Enables or disables the WhatsApp communication channel.                           |

---

## 5. UI Integration in Desktop (`EnvironmentView.tsx`)

Section 6 of `EnvironmentView.tsx` surfaces the WhatsApp Integration Card:

- Live status indicator (Active / Standby / Disconnected).
- Endpoint loopback lock badge (`127.0.0.1:3000`).
- HMAC-SHA256 signature verification badge.
- Prompt-injection defense status.
- One-click channel toggle (Enable / Disable).
- One-click pairing trigger.

---

## 6. Verification and Empirical Evidence

The WhatsApp adapter is verified by `tests/whatsapp_gowa_adapter.test.ts` (17 tests passing):

- Loopback binding verification and rejection of remote hosts.
- Constant-time HMAC-SHA256 signature verification and bad signature rejection.
- Owner JID authorization and rejection of unauthorized senders.
- Inbound prompt-injection marking (`untrustedInput: true`).
- Persistent deduplication prevents duplicate cognitive dispatch.
- Outbound sends with rate limiting and exponential retry backoff.
- Full server integration tests verifying `/api/whatsapp/*` endpoints.
