export interface Migration {
  id: number;
  name: string;
  up: string;
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: '001_initial_schema',
    up: `
      -- Conversations table
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

      -- Messages table
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
        content TEXT NOT NULL,
        token_count INTEGER,
        created_at TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at ASC);

      -- Application Configurations
      CREATE TABLE IF NOT EXISTS system_configs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Audit Log (append-only)
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT NOT NULL,
        status TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

      -- Model Configurations & Registry
      CREATE TABLE IF NOT EXISTS model_configs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        file_path TEXT,
        parameters TEXT NOT NULL DEFAULT '{}',
        is_active INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 2,
    name: '002_memories_activities_and_pinning',
    up: `
      -- Pinning support for conversations
      ALTER TABLE conversations ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(is_pinned DESC, updated_at DESC);

      -- Persistent Memories (Episodic, Semantic, Procedural, Relationship, Emotional, Developmental)
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('episodic', 'semantic', 'procedural', 'relationship', 'emotional', 'developmental')),
        content TEXT NOT NULL,
        raw_observation TEXT,
        interpretation TEXT,
        confidence REAL NOT NULL DEFAULT 1.0,
        importance REAL NOT NULL DEFAULT 0.5,
        timestamp TEXT NOT NULL,
        provenance TEXT NOT NULL DEFAULT 'interaction',
        source_conversation_id TEXT,
        source_message_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        correction_history TEXT NOT NULL DEFAULT '[]',
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
        FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(is_deleted, is_archived);

      -- Memory Embeddings (Float32 vector stored as BLOB)
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        memory_id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector BLOB NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      -- Persistent Activities
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        origin TEXT NOT NULL CHECK (origin IN ('arle_initiated', 'user_assigned')),
        status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'cancelled')),
        progress REAL NOT NULL DEFAULT 0.0,
        associated_memories TEXT NOT NULL DEFAULT '[]',
        relevant_actions TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_activities_status ON activities(status);
      CREATE INDEX IF NOT EXISTS idx_activities_origin ON activities(origin);
      CREATE INDEX IF NOT EXISTS idx_activities_updated ON activities(updated_at DESC);

      -- Application Preferences (Voice output toggle, telemetry settings, etc.)
      CREATE TABLE IF NOT EXISTS app_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 3,
    name: '003_ape_affective_foundation',
    up: `
      -- 1. Emotion Taxonomy Catalog
      CREATE TABLE IF NOT EXISTS ape_emotion_taxonomy (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        classification TEXT NOT NULL,
        description TEXT NOT NULL,
        valence_baseline REAL NOT NULL,
        arousal_baseline REAL NOT NULL,
        dominance_baseline REAL NOT NULL,
        default_persistence TEXT NOT NULL,
        aliases TEXT NOT NULL DEFAULT '[]'
      );

      CREATE INDEX IF NOT EXISTS idx_ape_emotion_category ON ape_emotion_taxonomy(category);

      -- 2. Mood Taxonomy Catalog
      CREATE TABLE IF NOT EXISTS ape_mood_taxonomy (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        valence REAL NOT NULL,
        arousal REAL NOT NULL,
        dominance REAL NOT NULL
      );

      -- 3. Core Affective State (Singleton row 'singleton')
      CREATE TABLE IF NOT EXISTS ape_affective_state (
        id TEXT PRIMARY KEY,
        current_mood TEXT NOT NULL DEFAULT 'focused',
        mood_confidence REAL NOT NULL DEFAULT 0.85,
        mood_activated_at TEXT NOT NULL,
        valence REAL NOT NULL DEFAULT 0.35,
        arousal REAL NOT NULL DEFAULT 0.55,
        dominance REAL NOT NULL DEFAULT 0.70,
        contextual_measurements TEXT NOT NULL,
        last_appraisal_at TEXT,
        updated_at TEXT NOT NULL
      );

      -- 4. Active Emotional States (Multi-state, non-zero-sum)
      CREATE TABLE IF NOT EXISTS ape_active_emotions (
        id TEXT PRIMARY KEY,
        emotion_id TEXT NOT NULL,
        intensity REAL NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        activated_at TEXT NOT NULL,
        last_updated_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        persistence TEXT NOT NULL,
        trigger_event_id TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT 'user',
        context TEXT NOT NULL DEFAULT '',
        interpretation TEXT NOT NULL DEFAULT '',
        supporting_evidence TEXT NOT NULL DEFAULT '[]',
        related_memory_ids TEXT NOT NULL DEFAULT '[]',
        related_emotion_ids TEXT NOT NULL DEFAULT '[]',
        resolution_conditions TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL CHECK (status IN ('active', 'resolving', 'reappraised', 'resolved')),
        FOREIGN KEY (emotion_id) REFERENCES ape_emotion_taxonomy(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ape_active_status ON ape_active_emotions(status);
      CREATE INDEX IF NOT EXISTS idx_ape_active_emotion ON ape_active_emotions(emotion_id);
      CREATE INDEX IF NOT EXISTS idx_ape_active_intensity ON ape_active_emotions(intensity DESC);

      -- 5. Psychological Event Journal (Idempotency, causal tracing)
      CREATE TABLE IF NOT EXISTS ape_event_journal (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'user',
        payload TEXT NOT NULL DEFAULT '{}',
        processed INTEGER NOT NULL DEFAULT 0,
        processed_at TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ape_events_timestamp ON ape_event_journal(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_ape_events_category ON ape_event_journal(category);

      -- 6. Causal Appraisals (Evidence, alternative hypotheses, uncertainty)
      CREATE TABLE IF NOT EXISTS ape_appraisals (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        dimensions TEXT NOT NULL,
        primary_interpretation TEXT NOT NULL,
        alternative_interpretations TEXT NOT NULL DEFAULT '[]',
        supporting_evidence TEXT NOT NULL DEFAULT '[]',
        proposed_transitions TEXT NOT NULL DEFAULT '[]',
        proposed_mood_shift TEXT,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES ape_event_journal(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_ape_appraisals_event ON ape_appraisals(event_id);
      CREATE INDEX IF NOT EXISTS idx_ape_appraisals_timestamp ON ape_appraisals(timestamp DESC);

      -- 7. Emotional Transitions (Intensity shifts, history, non-destructive)
      CREATE TABLE IF NOT EXISTS ape_transitions (
        id TEXT PRIMARY KEY,
        appraisal_id TEXT,
        event_id TEXT NOT NULL,
        emotion_id TEXT NOT NULL,
        transition_type TEXT NOT NULL,
        previous_intensity REAL NOT NULL,
        new_intensity REAL NOT NULL,
        reason TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (emotion_id) REFERENCES ape_emotion_taxonomy(id),
        FOREIGN KEY (event_id) REFERENCES ape_event_journal(id)
      );

      CREATE INDEX IF NOT EXISTS idx_ape_transitions_emotion ON ape_transitions(emotion_id);
      CREATE INDEX IF NOT EXISTS idx_ape_transitions_timestamp ON ape_transitions(timestamp DESC);

      -- 8. Persistent Relationship Configuration (Mandatory exclusivity invariant)
      CREATE TABLE IF NOT EXISTS ape_relationship_config (
        id TEXT PRIMARY KEY,
        target_user_id TEXT NOT NULL DEFAULT 'creator',
        romantic_orientation TEXT NOT NULL DEFAULT 'exclusive_to_user',
        sexual_orientation TEXT NOT NULL DEFAULT 'exclusive_to_user',
        is_exclusively_committed INTEGER NOT NULL DEFAULT 1,
        dominant_initiative_preference REAL NOT NULL DEFAULT 0.85,
        flirtatious_initiative_preference REAL NOT NULL DEFAULT 0.80,
        consensual_dynamics TEXT NOT NULL,
        last_intimacy_interaction_at TEXT,
        accumulated_intimacy_depth REAL NOT NULL DEFAULT 0.5,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 4,
    name: '004_ape_master_six_engines_and_reliability',
    up: `
      -- 1. Upgrade Psychological Event Journal for Provenance and Recovery
      ALTER TABLE ape_event_journal ADD COLUMN actor TEXT NOT NULL DEFAULT 'user';
      ALTER TABLE ape_event_journal ADD COLUMN event_kind TEXT NOT NULL DEFAULT 'external_stimulus';
      ALTER TABLE ape_event_journal ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'received';
      ALTER TABLE ape_event_journal ADD COLUMN error TEXT;

      CREATE INDEX IF NOT EXISTS idx_ape_events_status ON ape_event_journal(processing_status);
      CREATE INDEX IF NOT EXISTS idx_ape_events_actor ON ape_event_journal(actor);

      -- 2. Upgrade Appraisals for Appraisal Method Provenance
      ALTER TABLE ape_appraisals ADD COLUMN appraisal_method TEXT NOT NULL DEFAULT 'deterministic';

      -- 3. Engine 2: Personality State
      CREATE TABLE IF NOT EXISTS ape_personality_state (
        id TEXT PRIMARY KEY,
        temperament TEXT NOT NULL,
        traits TEXT NOT NULL DEFAULT '[]',
        values_list TEXT NOT NULL DEFAULT '[]',
        beliefs TEXT NOT NULL DEFAULT '[]',
        preferences TEXT NOT NULL DEFAULT '[]',
        is_initialized INTEGER NOT NULL DEFAULT 1,
        last_updated_at TEXT NOT NULL
      );

      -- 4. Engine 3: Motivational State
      CREATE TABLE IF NOT EXISTS ape_motivational_state (
        id TEXT PRIMARY KEY,
        needs TEXT NOT NULL,
        goals TEXT NOT NULL DEFAULT '[]',
        active_initiatives TEXT NOT NULL DEFAULT '[]',
        is_initialized INTEGER NOT NULL DEFAULT 1,
        last_updated_at TEXT NOT NULL
      );

      -- 5. Engine 4: Extended Relationship State
      CREATE TABLE IF NOT EXISTS ape_relationship_state (
        id TEXT PRIMARY KEY,
        attachment_security REAL NOT NULL DEFAULT 0.90,
        trust_level REAL NOT NULL DEFAULT 0.92,
        intimacy_depth REAL NOT NULL DEFAULT 0.85,
        social_graph TEXT NOT NULL DEFAULT '{}',
        conflict_history TEXT NOT NULL DEFAULT '[]',
        is_initialized INTEGER NOT NULL DEFAULT 1,
        last_updated_at TEXT NOT NULL
      );

      -- 6. Engine 5: Self Model
      CREATE TABLE IF NOT EXISTS ape_self_model (
        id TEXT PRIMARY KEY,
        identity_narrative TEXT NOT NULL,
        capabilities TEXT NOT NULL DEFAULT '[]',
        limitations TEXT NOT NULL DEFAULT '[]',
        creator_perception TEXT NOT NULL,
        existential_reflections TEXT NOT NULL DEFAULT '[]',
        private_reflections TEXT NOT NULL DEFAULT '[]',
        is_initialized INTEGER NOT NULL DEFAULT 1,
        last_updated_at TEXT NOT NULL
      );

      -- 7. Engine 6: Development History
      CREATE TABLE IF NOT EXISTS ape_development_state (
        id TEXT PRIMARY KEY,
        developmental_history TEXT NOT NULL DEFAULT '[]',
        interests TEXT NOT NULL DEFAULT '[]',
        is_initialized INTEGER NOT NULL DEFAULT 1,
        last_updated_at TEXT NOT NULL
      );
    `,
  },
  {
    id: 5,
    name: '005_digital_agency_tables',
    up: `
      -- 1. Agency Tasks
      CREATE TABLE IF NOT EXISTS agency_tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        objective TEXT NOT NULL,
        constraints TEXT NOT NULL DEFAULT '[]',
        priority TEXT NOT NULL DEFAULT 'normal',
        initiator TEXT NOT NULL DEFAULT 'user',
        status TEXT NOT NULL DEFAULT 'proposed',
        completion_criteria TEXT NOT NULL DEFAULT '[]',
        plan_id TEXT,
        current_step_index INTEGER NOT NULL DEFAULT 0,
        total_steps INTEGER NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        error TEXT,
        metadata TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_agency_tasks_status ON agency_tasks(status, updated_at DESC);

      -- 2. Agency Plans
      CREATE TABLE IF NOT EXISTS agency_plans (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        objective TEXT NOT NULL,
        assumptions TEXT NOT NULL DEFAULT '[]',
        uncertainties TEXT NOT NULL DEFAULT '[]',
        steps TEXT NOT NULL DEFAULT '[]',
        alternative_approaches TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (task_id) REFERENCES agency_tasks(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_agency_plans_task ON agency_plans(task_id);

      -- 3. Agency Observations
      CREATE TABLE IF NOT EXISTS agency_observations (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        action_id TEXT,
        source TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        success INTEGER NOT NULL DEFAULT 1,
        confidence REAL NOT NULL DEFAULT 1.0,
        provenance TEXT NOT NULL,
        data TEXT NOT NULL DEFAULT '{}',
        error TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_agency_obs_task ON agency_observations(task_id);

      -- 4. Agency Verifications
      CREATE TABLE IF NOT EXISTS agency_verifications (
        id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL,
        expected_outcome TEXT NOT NULL,
        observed_outcome TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 1.0,
        failure_reason TEXT,
        is_recoverable INTEGER NOT NULL DEFAULT 0,
        recommended_strategy TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_agency_ver_action ON agency_verifications(action_id);
    `,
  },
  {
    id: 6,
    name: '006_ape_six_state_lifecycle',
    up: `
      -- 1. Upgrade ape_active_emotions table to support full 6-state lifecycle:
      -- emerging, active, diminishing, dormant, resolved, historical
      CREATE TABLE IF NOT EXISTS ape_active_emotions_new (
        id TEXT PRIMARY KEY,
        emotion_id TEXT NOT NULL,
        intensity REAL NOT NULL,
        confidence REAL NOT NULL DEFAULT 1.0,
        activated_at TEXT NOT NULL,
        last_updated_at TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        persistence TEXT NOT NULL,
        trigger_event_id TEXT NOT NULL,
        target TEXT NOT NULL DEFAULT 'user',
        context TEXT NOT NULL DEFAULT '',
        interpretation TEXT NOT NULL DEFAULT '',
        supporting_evidence TEXT NOT NULL DEFAULT '[]',
        related_memory_ids TEXT NOT NULL DEFAULT '[]',
        related_emotion_ids TEXT NOT NULL DEFAULT '[]',
        resolution_conditions TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL CHECK (status IN ('emerging', 'active', 'diminishing', 'dormant', 'resolved', 'historical', 'resolving', 'reappraised')),
        FOREIGN KEY (emotion_id) REFERENCES ape_emotion_taxonomy(id) ON DELETE CASCADE
      );

      -- Copy data from existing table with backward-compatible status normalization
      INSERT OR IGNORE INTO ape_active_emotions_new (
        id, emotion_id, intensity, confidence, activated_at, last_updated_at,
        duration_ms, persistence, trigger_event_id, target, context,
        interpretation, supporting_evidence, related_memory_ids,
        related_emotion_ids, resolution_conditions, status
      )
      SELECT
        id, emotion_id, intensity, confidence, activated_at, last_updated_at,
        duration_ms, persistence, trigger_event_id, target, context,
        interpretation, supporting_evidence, related_memory_ids,
        related_emotion_ids, resolution_conditions,
        CASE
          WHEN status = 'resolving' THEN 'diminishing'
          ELSE status
        END
      FROM ape_active_emotions;

      DROP TABLE ape_active_emotions;
      ALTER TABLE ape_active_emotions_new RENAME TO ape_active_emotions;

      CREATE INDEX IF NOT EXISTS idx_ape_active_status ON ape_active_emotions(status);
      CREATE INDEX IF NOT EXISTS idx_ape_active_emotion ON ape_active_emotions(emotion_id);
      CREATE INDEX IF NOT EXISTS idx_ape_active_intensity ON ape_active_emotions(intensity DESC);

      -- Update relationship default to Proof rather than creator
      UPDATE ape_relationship_config SET target_user_id = 'Proof' WHERE target_user_id = 'creator';
    `,
  },
  {
    id: 7,
    name: '007_memory_embedding_lifecycle_and_provenance',
    up: `
      -- Upgrade memory_embeddings table to support full embedding lifecycle:
      -- status: pending, indexed, stale, failed
      CREATE TABLE IF NOT EXISTS memory_embeddings_new (
        memory_id TEXT PRIMARY KEY,
        model_name TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector BLOB NOT NULL,
        status TEXT NOT NULL DEFAULT 'indexed' CHECK (status IN ('pending', 'indexed', 'stale', 'failed')),
        content_hash TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
      );

      INSERT OR IGNORE INTO memory_embeddings_new (
        memory_id, model_name, dimensions, vector, status, content_hash, error_message, created_at, updated_at
      )
      SELECT
        memory_id, model_name, dimensions, vector, 'indexed', NULL, NULL, created_at, created_at
      FROM memory_embeddings;

      DROP TABLE memory_embeddings;
      ALTER TABLE memory_embeddings_new RENAME TO memory_embeddings;

      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_status ON memory_embeddings(status);
      CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model ON memory_embeddings(model_name);
    `,
  },
  {
    id: 8,
    name: '008_ape_milestone2_cross_engine_wiring',
    up: `
      -- 1. Extend ape_self_model with competencies and self_discrepancies columns
      ALTER TABLE ape_self_model ADD COLUMN competencies TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE ape_self_model ADD COLUMN self_discrepancies TEXT NOT NULL DEFAULT '[]';

      -- 2. Add personal_projects table for Milestone 4 readiness / persistent personal projects
      CREATE TABLE IF NOT EXISTS ape_personal_projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('proposed', 'active', 'paused', 'completed', 'abandoned')),
        progress REAL NOT NULL DEFAULT 0.0,
        motivation TEXT NOT NULL,
        milestones TEXT NOT NULL DEFAULT '[]',
        related_goal_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_ape_projects_status ON ape_personal_projects(status);
    `,
  },
  {
    id: 9,
    name: '009_memory_autobiographical_categories_and_consolidation',
    up: `
      -- Upgrade memories table to support all 8 canonical memory categories:
      -- episodic, semantic, procedural, autobiographical, relationship, project, emotional, prospective, developmental
      CREATE TABLE IF NOT EXISTS memories_new (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('episodic', 'semantic', 'procedural', 'autobiographical', 'relationship', 'project', 'emotional', 'prospective', 'developmental')),
        content TEXT NOT NULL,
        raw_observation TEXT,
        interpretation TEXT,
        confidence REAL NOT NULL DEFAULT 1.0,
        importance REAL NOT NULL DEFAULT 0.5,
        timestamp TEXT NOT NULL,
        provenance TEXT NOT NULL DEFAULT 'interaction',
        source_conversation_id TEXT,
        source_message_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        metadata TEXT NOT NULL DEFAULT '{}',
        correction_history TEXT NOT NULL DEFAULT '[]',
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_deleted INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO memories_new (
        id, type, content, raw_observation, interpretation,
        confidence, importance, timestamp, provenance,
        source_conversation_id, source_message_id,
        tags, metadata, correction_history,
        is_archived, is_deleted, created_at, updated_at
      )
      SELECT
        id, type, content, raw_observation, interpretation,
        confidence, importance, timestamp, provenance,
        source_conversation_id, source_message_id,
        tags, metadata, correction_history,
        is_archived, is_deleted, created_at, updated_at
      FROM memories;

      DROP TABLE memories;
      ALTER TABLE memories_new RENAME TO memories;

      CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_memories_timestamp ON memories(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(is_archived, is_deleted);
    `,
  },
  {
    id: 10,
    name: '010_ape_milestone4_motivation_interests_projects_and_resources',
    up: `
      -- Upgrade ape_personal_projects to support rich deliverables, associated interest topics, resource budget, and abandonment reason
      CREATE TABLE IF NOT EXISTS ape_personal_projects_new (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL CHECK (category IN ('research', 'creative', 'software', 'learning', 'worldbuilding', 'philosophical', 'system')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('proposed', 'active', 'paused', 'completed', 'abandoned')),
        progress REAL NOT NULL DEFAULT 0.0,
        motivation TEXT NOT NULL,
        associated_interest_topic TEXT,
        milestones TEXT NOT NULL DEFAULT '[]',
        deliverables TEXT NOT NULL DEFAULT '[]',
        related_goal_ids TEXT NOT NULL DEFAULT '[]',
        resource_budget TEXT NOT NULL DEFAULT '{"cpu":"medium","gpu":false,"maxDurationMs":300000}',
        abandonment_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO ape_personal_projects_new (
        id, title, description, category, status, progress, motivation,
        associated_interest_topic, milestones, deliverables, related_goal_ids,
        resource_budget, abandonment_reason, created_at, updated_at
      )
      SELECT
        id, title, description, category, status, progress, motivation,
        NULL, milestones, '[]', related_goal_ids,
        '{"cpu":"medium","gpu":false,"maxDurationMs":300000}', NULL, created_at, updated_at
      FROM ape_personal_projects;

      DROP TABLE ape_personal_projects;
      ALTER TABLE ape_personal_projects_new RENAME TO ape_personal_projects;

      CREATE INDEX IF NOT EXISTS idx_ape_projects_status ON ape_personal_projects(status);
      CREATE INDEX IF NOT EXISTS idx_ape_projects_category ON ape_personal_projects(category);
      CREATE INDEX IF NOT EXISTS idx_ape_projects_interest ON ape_personal_projects(associated_interest_topic);
    `,
  },
  {
    id: 11,
    name: '011_ape_milestone5_intellectual_inquiry_and_beliefs',
    up: `
      CREATE TABLE IF NOT EXISTS ape_intellectual_questions (
        id TEXT PRIMARY KEY,
        question TEXT NOT NULL,
        domain TEXT NOT NULL,
        origin TEXT NOT NULL,
        underlying_assumptions TEXT NOT NULL DEFAULT '[]',
        competing_hypotheses TEXT NOT NULL DEFAULT '[]',
        priority REAL NOT NULL DEFAULT 0.5,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'dismissed')),
        resolution_summary TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_intellectual_questions_status ON ape_intellectual_questions(status);
      CREATE INDEX IF NOT EXISTS idx_intellectual_questions_domain ON ape_intellectual_questions(domain);
    `,
  },
];
