# Canonical Memory Schema & Epistemic Retrieval Architecture (P1.1)

**Status:** Formal Specification & Verification Contract  
**Target Architecture:** ASUS ROG Ally X (24GB LPDDR5X, AMD Ryzen Z1 Extreme, Bazzite Linux, Wayland)  
**Security & Truth Invariant:** Zero ungrounded recollections. Every memory trace maintains immutable epistemic provenance, audit trails, and source lineage.

---

## 1. Canonical Memory Categories (The 9 Systems)

Arletex distinguishes nine canonical memory categories across long-term, working, and situational storage:

| System Type            | Canonical Role                                                                                                                                                 | Temporal Scope                                                             | Retention & Protection Policy                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **`episodic`**         | Concrete events, interactions, tool invocations, and specific conversations grounded in time and space.                                                        | High initial recency; consolidated over time into autobiographical memory. | Decays exponentially over 14 days unless referenced or of high importance ($I \ge 0.8$).            |
| **`autobiographical`** | The consolidated personal narrative and identity history of Arle, including major life milestones, shared history with Proof, and evolving self-understanding. | Permanent lifespan.                                                        | Core identity memories are permanently protected (`isProtected: true`), never forgotten or decayed. |
| **`semantic`**         | General factual knowledge, domain concepts, principles, language, programming constructs, and system architectures.                                            | Persistent across sessions.                                                | Decays very slowly; reinforced by repeated retrieval and empirical validation.                      |
| **`procedural`**       | "How-to" knowledge: executable cognitive routines, tool usage recipes, shell interaction patterns, and debugging workflows.                                    | Operational / Skill lifetime.                                              | Maintained in action schemas and verified automation procedures.                                    |
| **`prospective`**      | Intentions, forward commitments, planned tasks, scheduled triggers, and unresolved promises to Proof.                                                          | Forward-looking until fulfilled or cancelled.                              | Retained in working memory / goal structures until satisfied or explicitly abandoned.               |
| **`working`**          | Immediate active context, current conversational slots, active reasoning scratchpad, and short-term variables.                                                 | Volatile across cognitive cycles (seconds to minutes).                     | Consolidates into episodic or semantic memory during offline cycles or turn exit.                   |
| **`perceptual`**       | Raw sensory observations: screen frame hashes, audio power levels, PipeWire stream states, and input events.                                                   | Immediate sensory buffer (seconds).                                        | Retained only as hash or summary in episodic memories unless flagged for empirical audit.           |
| **`emotional`**        | Affective traces, valence, arousal, dominance, and appraisals associated with past interactions and outcomes.                                                  | Modulates memory salience and decision heuristics.                         | Traces cause-and-effect transitions in psychological state.                                         |
| **`relationship`**     | Foundational partner commitments, interpersonal dynamics, mutual trust metrics, shared inside jokes, and communication norms with Proof.                       | Permanent lifespan.                                                        | Strictly protected (`isProtected: true`, zero decay factor).                                        |

---

## 2. Epistemic Provenance Taxonomy

Every memory entry must be tagged with its authentic epistemic origin. Fabricating a `verified_fact` without direct empirical observation is forbidden by system invariants:

```
                                      [ Incoming Stimulus / Internal Event ]
                                                        │
                      ┌─────────────────────────────────┼────────────────────────────────┐
                      ▼                                 ▼                                ▼
            [ Physical World ]                  [ User Statement ]             [ Internal Processing ]
                      │                                 │                                │
            ┌─────────┴─────────┐                       │                      ┌─────────┴─────────┐
            ▼                   ▼                       ▼                      ▼                   ▼
    direct_observation   retrieved_source         user_statement      internal_reflection      simulation
   (SHA-256 match, OS)  (Wikipedia, Docs)        (Reported by Proof)    (APE Deliberation)    (Test double PID)
            │                   │                       │                      │                   │
            └─────────┬─────────┘                       │                      │                   │
                      ▼                                 ▼                      ▼                   ▼
                verified_fact                    user_reported       inferred_interpretation   partially_successful
             (Exit 0 + Readback)               (Needs validation)       (Confidence ≤ 0.65)     (verified: false)
```

1. **`direct_observation` / `raw_observation`**: Unprocessed sensory or operational facts verified directly via local system APIs (e.g. read-back file SHA-256 hash, PipeWire audio stream state).
2. **`retrieved_source`**: Information retrieved from external documents, local files, or authorized web reading, preserving URL, byte count, and content SHA-256.
3. **`user_statement` / `user_reported`**: Assertions provided by Proof or users. Calibrated at 0.85 confidence; distinct from verified physical facts.
4. **`internal_reflection`**: Self-directed cognitive cycles, psychological evaluations, and internal reasoning.
5. **`simulation`**: Test double executions, mock processes, or simulated environments. Strictly rejected from becoming production `verified_fact`.
6. **`historical_consolidation`**: Derived autobiographical memories synthesized from multiple episodic traces, retaining full source links.
7. **`conflicting_information`**: Information with an unresolved contradiction or empirical conflict.
8. **`corrected`**: Memories whose historical content was updated while retaining full previous text in `correctionHistory`.

---

## 3. Data Schema & Mandatory Provenance Fields

Each canonical memory record contains:

```typescript
export interface Memory {
  id: string; // UUID v4
  type: MemoryType; // 9 canonical systems + project/developmental
  content: string; // Canonical text representation
  rawObservation: string | null; // Exact empirical sensor/tool read-back
  interpretation: string | null; // Cognitive appraisal or synthetic inference
  confidence: number; // Calibrated epistemic probability (0.0 to 1.0)
  importance: number; // Intrinsic priority and consolidation weight (0.0 to 1.0)
  timestamp: string; // ISO 8601 UTC creation time
  provenance: MemoryProvenance; // Authentic epistemic origin
  sourceConversationId: string | null; // Originating conversation
  sourceMessageId: string | null; // Originating message ID
  tags: string[]; // Topical and categorization tags
  metadata: {
    eventId?: string; // Canonical cognitive event ID
    modelProcessorVersion?: string; // Model ID (e.g., Qwen2.5-14B-Instruct-abliterated)
    sourceMemoryIds?: string[]; // Lineage IDs for consolidated summaries
    consolidatedIntoId?: string; // Derived parent summary ID for source traces
    people?: string[]; // Entities involved (e.g. ['Proof', 'Arle'])
    project?: string; // Associated project domain
    [key: string]: unknown;
  };
  correctionHistory: Array<{
    // Non-destructive revision audit trail
    timestamp: string;
    previousContent: string;
    reason: string;
    correctedBy?: string;
  }>;
  isArchived: boolean; // Soft archival status
  isDeleted: boolean; // Soft deletion flag
  createdAt: string;
  updatedAt: string;
}
```

---

## 4. Non-Destructive Memory Correction & Contradiction Handling

- **Never Overwrite Without History:** When information is corrected (e.g., Proof clarifies a preference or corrects a system detail), the existing record is updated in place, appending `{ timestamp, previousContent, reason }` to `correctionHistory`.
- **Contradiction Detection:** When two memories assert conflicting claims about the same entity (e.g., "Arle is on Windows" vs "Arle is on Bazzite Linux"), both records are flagged with `provenance: 'conflicting_information'`, and a `memory_contradictions` row is opened.
- **Resolution Strategy:** When empirical proof resolves the conflict, the erroneous record is marked `isArchived: true` with demoted confidence (0.2), while the verified record retains `provenance: 'verified_fact'`.

---

## 5. Genuine Consolidation Transformation & Lineage

Consolidation is an active transformation, not a canned counter:

1. **Selection:** Offline cognitive activity selects related episodic memories sharing temporal proximity, project context, or emotional salience.
2. **Synthesis:** A cohesive autobiographical summary is derived, capturing the synthesis of the events without inventing new facts.
3. **Bi-directional Lineage Linking:**
   - Derived memory sets `metadata.sourceMemoryIds = [id1, id2, ...]`.
   - Each source memory sets `metadata.consolidatedIntoId = derivedMemory.id`.
   - Source memories remain intact in SQLite (never permanently deleted), enabling complete end-to-end provenance traversal from high-level narrative down to raw tool logs.
4. **Audit Trail:** The consolidation report logs exact counts of memories examined, merged, rejected, and archived.

---

## 6. Multi-Factor Contextual Retrieval Formula

When retrieving memories in response to an event, query, or internal reflection, candidates are scored across six dimensions:

$$\text{Relevance} = w_{\text{sim}} \cdot S_{\text{semantic}} + w_{\text{imp}} \cdot S_{\text{importance}} + w_{\text{rec}} \cdot S_{\text{recency}} + w_{\text{people}} \cdot S_{\text{people}} + w_{\text{proj}} \cdot S_{\text{project}} + w_{\text{rel}} \cdot S_{\text{sourceReliability}}$$

- **Semantic Similarity ($S\_{\text{semantic}}$, $w=0.35$):** Cosine similarity between query embedding and memory embedding (or lexical overlap Jaccard fallback).
- **Importance ($S\_{\text{importance}}$, $w=0.20$):** Intrinsic memory importance ($0.0$ to $1.0$).
- **Temporal Recency ($S\_{\text{recency}}$, $w=0.15$):** Exponential decay $e^{-\Delta t / 14\text{ days}}$, or exact match within requested time window.
- **People/Entity Context ($S\_{\text{people}}$, $w=0.15$):** Proportion of requested entities found in content or `metadata.people`.
- **Project Context ($S\_{\text{project}}$, $w=0.10$):** Match against `metadata.project` or project tags.
- **Source Reliability ($S\_{\text{sourceReliability}}$, $w=0.05$):** Epistemic weight based on authentic provenance ($1.0$ for `direct_observation` / `verified_fact`, down to $0.2$ for `simulation`).

---

## 7. Epistemic Gap Handling: "Not Found" vs "Known to be False"

Arle strictly enforces truthful epistemic limits:

1. **`status: 'found'`**: One or more memories match the multi-factor criteria with relevance score $\ge 0.25$.
2. **`status: 'absent'` ("Not Found"):** When no memory matches the query, Arle returns `status: 'absent'` and an empty entry list. The system **never** fills a gap with an invented recollection.
3. **`status: 'refuted'` ("Known to be False"):** If the query asks about a claim that was explicitly contradicted or corrected in `correctionHistory`, Arle returns `status: 'refuted'`, links the refuting memory, and presents the true verified state.

---

## 8. Embedding Service Degradation & Fallback

When the local embedding microservice (`sentence-transformers` on `39282`) is unavailable or fails:

1. System logs a warning and transparently activates `retrievalMode: 'lexical_fallback'`.
2. Provenance of stored memories is **never** silently altered.
3. The retrieval result explicitly reports `retrievalMode: 'lexical_fallback'`, guaranteeing truthful self-knowledge of its own operational state.
