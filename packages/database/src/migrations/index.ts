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
  {
    id: 12,
    name: '012_persistent_individual_continuity',
    up: `
      -- 1. Identity Sessions (Persistent presence, heartbeats, downtime tracking)
      CREATE TABLE IF NOT EXISTS identity_sessions (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        last_heartbeat_at TEXT NOT NULL,
        ended_at TEXT,
        shutdown_type TEXT NOT NULL DEFAULT 'active' CHECK (shutdown_type IN ('active', 'clean', 'unexpected_crash', 'interrupted')),
        channel_origin TEXT NOT NULL DEFAULT 'desktop' CHECK (channel_origin IN ('desktop', 'telegram', 'cli', 'unified', 'system')),
        active_inference_model TEXT NOT NULL DEFAULT 'qwen-2.5-7b',
        memory_count INTEGER NOT NULL DEFAULT 0,
        active_emotions_count INTEGER NOT NULL DEFAULT 0,
        downtime_from_previous_ms INTEGER NOT NULL DEFAULT 0,
        metadata TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_identity_sessions_shutdown ON identity_sessions(shutdown_type);
      CREATE INDEX IF NOT EXISTS idx_identity_sessions_started ON identity_sessions(started_at DESC);

      -- 2. Identity Checkpoints (Cryptographically hashed snapshots, corruption rollback)
      CREATE TABLE IF NOT EXISTS identity_checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        checkpoint_type TEXT NOT NULL CHECK (checkpoint_type IN ('periodic', 'clean_shutdown', 'pre_recovery', 'manual', 'state_transition')),
        state_hash TEXT NOT NULL,
        master_state_json TEXT NOT NULL,
        memory_count INTEGER NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 12,
        is_verified_valid INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES identity_sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_identity_checkpoints_created ON identity_checkpoints(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_identity_checkpoints_valid ON identity_checkpoints(is_verified_valid, created_at DESC);

      -- 3. Channel Presences (Cross-channel shared presence and context tracking)
      CREATE TABLE IF NOT EXISTS channel_presences (
        channel TEXT PRIMARY KEY CHECK (channel IN ('desktop', 'telegram', 'cli', 'unified', 'system')),
        last_interaction_at TEXT NOT NULL,
        interaction_count INTEGER NOT NULL DEFAULT 0,
        active_context_summary TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL
      );

      -- 4. Component State Versioning
      CREATE TABLE IF NOT EXISTS system_state_versions (
        component TEXT PRIMARY KEY,
        version INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('identity_continuity', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 13,
    name: '013_self_model_milestone2',
    up: `
      -- Extend ape_self_model with structured capabilities, limitations, perceived capabilities, and behavioral changes
      ALTER TABLE ape_self_model ADD COLUMN structured_capabilities TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE ape_self_model ADD COLUMN structured_limitations TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE ape_self_model ADD COLUMN perceived_capabilities TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE ape_self_model ADD COLUMN behavioral_changes TEXT NOT NULL DEFAULT '[]';

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('self_model_milestone2', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 14,
    name: '014_narrative_identity_milestone3',
    up: `
      -- Narrative Epochs (autobiographical life chapters)
      CREATE TABLE IF NOT EXISTS narrative_epochs (
        id TEXT PRIMARY KEY,
        order_index INTEGER NOT NULL,
        title TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT,
        core_theme TEXT NOT NULL,
        narrative_summary TEXT NOT NULL,
        turning_point_description TEXT NOT NULL,
        milestone_ids TEXT NOT NULL DEFAULT '[]',
        dominant_mood TEXT NOT NULL DEFAULT 'composed',
        developmental_arc TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Personal Milestones (significant autobiographical events, turning points, breakthroughs)
      CREATE TABLE IF NOT EXISTS personal_milestones (
        id TEXT PRIMARY KEY,
        epoch_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        category TEXT NOT NULL,
        significance_score REAL NOT NULL DEFAULT 0.5,
        timestamp TEXT NOT NULL,
        associated_memory_ids TEXT NOT NULL DEFAULT '[]',
        psychological_impact TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active',
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Narrative Interpretations (reappraisals and causal links between past memories and present self)
      CREATE TABLE IF NOT EXISTS narrative_interpretations (
        id TEXT PRIMARY KEY,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        initial_interpretation TEXT NOT NULL,
        current_interpretation TEXT NOT NULL,
        causal_connection_to_present TEXT NOT NULL,
        reconsideration_history TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Narrative State Singleton (global identity continuity, invariants, and overarching autobiography)
      CREATE TABLE IF NOT EXISTS narrative_state (
        id TEXT PRIMARY KEY,
        current_epoch_id TEXT NOT NULL,
        core_invariants TEXT NOT NULL DEFAULT '[]',
        temporal_comparisons TEXT NOT NULL DEFAULT '[]',
        coherence_score REAL NOT NULL DEFAULT 1.0,
        autobiographical_summary TEXT NOT NULL,
        last_consolidated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_personal_milestones_epoch ON personal_milestones (epoch_id);
      CREATE INDEX IF NOT EXISTS idx_personal_milestones_category ON personal_milestones (category);
      CREATE INDEX IF NOT EXISTS idx_personal_milestones_timestamp ON personal_milestones (timestamp);
      CREATE INDEX IF NOT EXISTS idx_narrative_epochs_status ON narrative_epochs (status);
      CREATE INDEX IF NOT EXISTS idx_narrative_interpretations_target ON narrative_interpretations (target_type, target_id);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('narrative_identity_milestone3', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 15,
    name: '015_temporal_cognition_milestone4',
    up: `
      -- Future Intentions (prospective intentions and time-based action triggers)
      CREATE TABLE IF NOT EXISTS future_intentions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        intended_for TEXT NOT NULL,
        trigger_condition TEXT,
        priority REAL NOT NULL DEFAULT 0.5,
        status TEXT NOT NULL DEFAULT 'pending',
        origin TEXT NOT NULL DEFAULT 'spontaneous',
        associated_goal_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Unfinished Commitments (pacts, promises, and relational/project agreements)
      CREATE TABLE IF NOT EXISTS unfinished_commitments (
        id TEXT PRIMARY KEY,
        partner_name TEXT NOT NULL DEFAULT 'Proof',
        commitment_text TEXT NOT NULL,
        context TEXT NOT NULL DEFAULT '',
        committed_at TEXT NOT NULL,
        target_fulfillment_time TEXT,
        deadline_type TEXT NOT NULL DEFAULT 'soft_target',
        status TEXT NOT NULL DEFAULT 'active',
        verification_criteria TEXT NOT NULL,
        fulfillment_evidence TEXT,
        fulfilled_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Long Term Plans (multi-stage strategic roadmaps, milestones, dependencies)
      CREATE TABLE IF NOT EXISTS long_term_plans (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        vision_statement TEXT NOT NULL,
        horizon TEXT NOT NULL DEFAULT 'medium_term',
        milestones TEXT NOT NULL DEFAULT '[]',
        contingency_plans TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active',
        target_completion_date TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Duration Profiles (empirical execution metrics learned across operations)
      CREATE TABLE IF NOT EXISTS duration_profiles (
        operation_key TEXT PRIMARY KEY,
        sample_count INTEGER NOT NULL DEFAULT 0,
        average_duration_ms REAL NOT NULL DEFAULT 0,
        min_duration_ms REAL NOT NULL DEFAULT 0,
        max_duration_ms REAL NOT NULL DEFAULT 0,
        standard_deviation_ms REAL NOT NULL DEFAULT 0,
        confidence_score REAL NOT NULL DEFAULT 0.5,
        last_calibrated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_future_intentions_status ON future_intentions (status, intended_for);
      CREATE INDEX IF NOT EXISTS idx_unfinished_commitments_status ON unfinished_commitments (status, target_fulfillment_time);
      CREATE INDEX IF NOT EXISTS idx_long_term_plans_status ON long_term_plans (status);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('temporal_cognition_milestone4', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 16,
    name: '016_world_model_milestone5',
    up: `
      -- World Entities (people, agents, systems, objects, locations, artifacts, services)
      CREATE TABLE IF NOT EXISTS world_entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        entity_type TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        location_id TEXT,
        certainty TEXT NOT NULL DEFAULT 'empirical_observation',
        confidence REAL NOT NULL DEFAULT 0.8,
        source_provenance TEXT NOT NULL DEFAULT 'direct_observation',
        last_observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- World Relations (directed or bidirectional relationships between entities)
      CREATE TABLE IF NOT EXISTS world_relations (
        id TEXT PRIMARY KEY,
        source_entity_id TEXT NOT NULL,
        target_entity_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        properties TEXT NOT NULL DEFAULT '{}',
        confidence REAL NOT NULL DEFAULT 0.8,
        certainty TEXT NOT NULL DEFAULT 'empirical_observation',
        is_bidirectional INTEGER NOT NULL DEFAULT 0,
        last_observed_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- World Environmental Changes (log of state changes, file mutations, service status changes)
      CREATE TABLE IF NOT EXISTS world_environmental_changes (
        id TEXT PRIMARY KEY,
        entity_id TEXT,
        change_type TEXT NOT NULL,
        previous_state TEXT,
        new_state TEXT NOT NULL DEFAULT '{}',
        observed_at TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'environmental_telemetry',
        description TEXT NOT NULL
      );

      -- World Causal Relationships (A causes B under condition with empirical reliability)
      CREATE TABLE IF NOT EXISTS world_causal_relationships (
        id TEXT PRIMARY KEY,
        cause_entity_id TEXT NOT NULL,
        effect_entity_id TEXT NOT NULL,
        condition TEXT,
        mechanism TEXT NOT NULL,
        empirical_reliability REAL NOT NULL DEFAULT 0.9,
        confidence REAL NOT NULL DEFAULT 0.85,
        created_at TEXT NOT NULL
      );

      -- World Epistemic Unknowns (explicit tracking of open questions, unknown information, investigation frontier)
      CREATE TABLE IF NOT EXISTS world_epistemic_unknowns (
        id TEXT PRIMARY KEY,
        topic TEXT NOT NULL,
        question TEXT NOT NULL,
        domain TEXT NOT NULL DEFAULT 'general',
        priority REAL NOT NULL DEFAULT 0.5,
        status TEXT NOT NULL DEFAULT 'open',
        resolution_evidence TEXT,
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_world_entities_name ON world_entities (name);
      CREATE INDEX IF NOT EXISTS idx_world_entities_type ON world_entities (entity_type, category);
      CREATE INDEX IF NOT EXISTS idx_world_relations_source ON world_relations (source_entity_id, relation_type);
      CREATE INDEX IF NOT EXISTS idx_world_relations_target ON world_relations (target_entity_id, relation_type);
      CREATE INDEX IF NOT EXISTS idx_world_changes_entity ON world_environmental_changes (entity_id, observed_at);
      CREATE INDEX IF NOT EXISTS idx_world_unknowns_status ON world_epistemic_unknowns (status, priority);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('world_model_milestone5', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 17,
    name: '017_multimodal_perception_milestone6',
    up: `
      -- Unified Perceptual Frames (snapshots of fused sensory state)
      CREATE TABLE IF NOT EXISTS perceptual_frames (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        modalities TEXT NOT NULL,
        visual_summary TEXT,
        audio_summary TEXT,
        screen_summary TEXT,
        scene TEXT NOT NULL,
        detected_objects TEXT NOT NULL DEFAULT '[]',
        perceptual_events TEXT NOT NULL DEFAULT '[]',
        direct_observations TEXT NOT NULL DEFAULT '[]',
        assumptions TEXT NOT NULL DEFAULT '[]',
        overall_confidence REAL NOT NULL DEFAULT 0.85,
        perceptual_context_synthesis TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Perceptual Events (individual detected events across modalities)
      CREATE TABLE IF NOT EXISTS perceptual_events (
        id TEXT PRIMARY KEY,
        frame_id TEXT,
        event_type TEXT NOT NULL,
        modality TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        description TEXT NOT NULL,
        duration_ms REAL,
        confidence REAL NOT NULL DEFAULT 0.9,
        created_at TEXT NOT NULL
      );

      -- Detected Objects (catalog of recognized visual/audio/screen entities)
      CREATE TABLE IF NOT EXISTS perceptual_detected_objects (
        id TEXT PRIMARY KEY,
        frame_id TEXT,
        label TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'general',
        confidence REAL NOT NULL DEFAULT 0.85,
        bounding_box TEXT,
        attributes TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_perceptual_frames_time ON perceptual_frames (timestamp);
      CREATE INDEX IF NOT EXISTS idx_perceptual_events_type ON perceptual_events (event_type, modality);
      CREATE INDEX IF NOT EXISTS idx_perceptual_objects_label ON perceptual_detected_objects (label, category);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('multimodal_perception_milestone6', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 18,
    name: '018_embodiment_interoception_milestone7',
    up: `
      -- Interoceptive Snapshots (telemetry, model/tool availability, workload, operational mode)
      CREATE TABLE IF NOT EXISTS interoceptive_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        resource_metrics TEXT NOT NULL,
        model_availability TEXT NOT NULL,
        tool_availability TEXT NOT NULL,
        cognitive_workload TEXT NOT NULL,
        operational_mode TEXT NOT NULL,
        constraints TEXT NOT NULL DEFAULT '[]',
        directive TEXT NOT NULL,
        digital_physiological_report TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Operational Constraint Events (mode transitions and triggers)
      CREATE TABLE IF NOT EXISTS operational_constraint_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        previous_mode TEXT NOT NULL,
        new_mode TEXT NOT NULL,
        trigger_reason TEXT NOT NULL,
        resource_state TEXT NOT NULL,
        directive_issued TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Resource Regulation Directives History
      CREATE TABLE IF NOT EXISTS resource_regulation_history (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        mode TEXT NOT NULL,
        throttle_background_tasks INTEGER NOT NULL DEFAULT 0,
        max_context_tokens_adjustment INTEGER NOT NULL DEFAULT 0,
        suspend_heavy_multimodal INTEGER NOT NULL DEFAULT 0,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_interoceptive_snapshots_time ON interoceptive_snapshots (timestamp);
      CREATE INDEX IF NOT EXISTS idx_interoceptive_snapshots_mode ON interoceptive_snapshots (operational_mode);
      CREATE INDEX IF NOT EXISTS idx_operational_events_time ON operational_constraint_events (timestamp);
      CREATE INDEX IF NOT EXISTS idx_regulation_history_time ON resource_regulation_history (timestamp);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('embodiment_interoception_milestone7', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 19,
    name: '019_sensorimotor_action_grounding_milestone8',
    up: `
      -- Sensorimotor Action Records (attempts, executions, verified outcomes, epistemic distinctions)
      CREATE TABLE IF NOT EXISTS sensorimotor_action_records (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        intention_id TEXT,
        action_type TEXT NOT NULL,
        spatial_target TEXT NOT NULL,
        intended_outcome TEXT NOT NULL,
        attempted_payload TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        execution_status TEXT NOT NULL,
        verification TEXT NOT NULL,
        distinction_analysis TEXT NOT NULL,
        duration_ms REAL NOT NULL DEFAULT 0,
        retry_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      -- Interaction Strategies (learned action patterns and empirical success rates)
      CREATE TABLE IF NOT EXISTS interaction_strategies (
        id TEXT PRIMARY KEY,
        target_app_or_context TEXT NOT NULL,
        goal_type TEXT NOT NULL,
        primary_sequence TEXT NOT NULL,
        fallback_sequence TEXT,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        empirical_reliability REAL NOT NULL DEFAULT 0.5,
        last_used_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- Spatial Calibrations (display coordinate understanding and window geometry)
      CREATE TABLE IF NOT EXISTS sensorimotor_spatial_calibrations (
        id TEXT PRIMARY KEY,
        display_id TEXT NOT NULL DEFAULT 'primary',
        screen_width INTEGER NOT NULL,
        screen_height INTEGER NOT NULL,
        scale_factor REAL NOT NULL DEFAULT 1.0,
        active_windows TEXT NOT NULL DEFAULT '[]',
        calibrated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sensorimotor_actions_time ON sensorimotor_action_records (executed_at);
      CREATE INDEX IF NOT EXISTS idx_sensorimotor_actions_type ON sensorimotor_action_records (action_type);
      CREATE INDEX IF NOT EXISTS idx_sensorimotor_actions_session ON sensorimotor_action_records (session_id);
      CREATE INDEX IF NOT EXISTS idx_interaction_strategies_context ON interaction_strategies (target_app_or_context, goal_type);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('sensorimotor_action_grounding_milestone8', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 20,
    name: '020_situational_awareness_milestone9',
    up: `
      -- Operational Activities (tracking Arle's current activity, status, active app, and associated goal)
      CREATE TABLE IF NOT EXISTS operational_activities (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        last_active_at TEXT NOT NULL,
        active_application TEXT NOT NULL,
        associated_goal_id TEXT,
        created_at TEXT NOT NULL
      );

      -- Environmental Events (foreground/background events, relevance scores, interruptions)
      CREATE TABLE IF NOT EXISTS environmental_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        event_type TEXT NOT NULL,
        layer TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL,
        relevance_score REAL NOT NULL DEFAULT 0.5,
        is_interruption INTEGER NOT NULL DEFAULT 0,
        interrupted_activity_id TEXT,
        created_at TEXT NOT NULL
      );

      -- Situational Context Snapshots
      CREATE TABLE IF NOT EXISTS situational_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        current_activity_id TEXT,
        snapshot_data TEXT NOT NULL,
        situational_narrative TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_operational_activities_status ON operational_activities (status, last_active_at);
      CREATE INDEX IF NOT EXISTS idx_environmental_events_layer ON environmental_events (layer, relevance_score, timestamp);
      CREATE INDEX IF NOT EXISTS idx_situational_snapshots_time ON situational_snapshots (timestamp);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('situational_awareness_milestone9', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 21,
    name: '021_attention_and_salience_milestone10',
    up: `
      -- Attentional Focus Snapshots (tracking focal target, peripheral targets, capacity, and overload)
      CREATE TABLE IF NOT EXISTS attentional_focus_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        focal_target TEXT,
        peripheral_targets TEXT NOT NULL DEFAULT '[]',
        total_stimuli_evaluated INTEGER NOT NULL DEFAULT 0,
        filtered_stimuli_count INTEGER NOT NULL DEFAULT 0,
        is_overloaded INTEGER NOT NULL DEFAULT 0,
        attention_capacity REAL NOT NULL DEFAULT 100.0,
        available_capacity REAL NOT NULL DEFAULT 100.0,
        active_goals TEXT NOT NULL DEFAULT '[]',
        active_interests TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      -- Attention Switch Events (auditing intentional and urgency-driven attention shifts)
      CREATE TABLE IF NOT EXISTS attention_switch_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        previous_target_id TEXT,
        new_target_id TEXT NOT NULL,
        switch_reason TEXT NOT NULL,
        switching_cost_ms REAL NOT NULL DEFAULT 50,
        forced_by_urgency INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      -- Attentional Stimuli Records (evaluations, salience breakdowns, attended vs discarded)
      CREATE TABLE IF NOT EXISTS attentional_stimuli_records (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        stimulus_type TEXT NOT NULL,
        source TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT,
        salience_breakdown TEXT NOT NULL,
        was_attended INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_focus_snapshots_time ON attentional_focus_snapshots (timestamp);
      CREATE INDEX IF NOT EXISTS idx_switch_events_time ON attention_switch_events (timestamp);
      CREATE INDEX IF NOT EXISTS idx_stimuli_records_time ON attentional_stimuli_records (timestamp, was_attended);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('attention_salience_milestone10', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 22,
    name: '022_working_memory_milestone11',
    up: `
      -- Working Memory Buffers (active task context, retained items, intermediate reasoning, capacity limits)
      CREATE TABLE IF NOT EXISTS working_memory_buffers (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        goal_title TEXT NOT NULL,
        items TEXT NOT NULL DEFAULT '[]',
        intermediate_steps TEXT NOT NULL DEFAULT '[]',
        considerations TEXT NOT NULL DEFAULT '[]',
        max_capacity INTEGER NOT NULL DEFAULT 7,
        used_slots INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      -- Working Memory Snapshots (context recovery after interruptions, consolidated summaries)
      CREATE TABLE IF NOT EXISTS working_memory_snapshots (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        task_id TEXT NOT NULL,
        buffer_data TEXT NOT NULL,
        consolidated_summary TEXT NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_working_memory_buffers_task ON working_memory_buffers (task_id);
      CREATE INDEX IF NOT EXISTS idx_working_memory_snapshots_time ON working_memory_snapshots (timestamp, task_id);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('working_memory_milestone11', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 23,
    name: '023_multi_system_memory_milestone12',
    up: `
      -- Multi-System Memory Entries (differentiated memory architecture across 9 systems)
      CREATE TABLE IF NOT EXISTS multi_system_memory_entries (
        id TEXT PRIMARY KEY,
        system_type TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        source_data TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.8,
        importance REAL NOT NULL DEFAULT 0.5,
        decay_factor REAL NOT NULL DEFAULT 0.05,
        tags TEXT NOT NULL DEFAULT '[]',
        associations TEXT NOT NULL DEFAULT '[]',
        contradiction_with_id TEXT,
        correction_trail TEXT NOT NULL DEFAULT '[]',
        is_protected INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_retrieved_at TEXT NOT NULL
      );

      -- Memory Contradictions (tracking epistemic disputes and resolution strategies)
      CREATE TABLE IF NOT EXISTS memory_contradictions (
        id TEXT PRIMARY KEY,
        memory_id_a TEXT NOT NULL,
        memory_id_b TEXT NOT NULL,
        conflict_description TEXT NOT NULL,
        detected_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        resolution_strategy TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_multi_system_memory_type ON multi_system_memory_entries (system_type, is_archived);
      CREATE INDEX IF NOT EXISTS idx_multi_system_memory_created ON multi_system_memory_entries (created_at);
      CREATE INDEX IF NOT EXISTS idx_memory_contradictions_status ON memory_contradictions (status);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('multi_system_memory_milestone12', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 24,
    name: '024_learning_and_adaptation_milestone13',
    up: `
      -- Learning Experiences (empirical experiences across channels: direct, observation, instruction, mistake, success)
      CREATE TABLE IF NOT EXISTS learning_experiences (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        domain TEXT NOT NULL,
        context TEXT NOT NULL,
        action_taken TEXT NOT NULL,
        outcome TEXT NOT NULL,
        outcome_details TEXT NOT NULL,
        reward_score REAL NOT NULL,
        lessons_learned TEXT NOT NULL DEFAULT '[]',
        metadata TEXT,
        timestamp TEXT NOT NULL
      );

      -- Behavioral Adaptation Rules (empirically derived rules for continuous behavior modification)
      CREATE TABLE IF NOT EXISTS behavioral_adaptation_rules (
        id TEXT PRIMARY KEY,
        source_experience_ids TEXT NOT NULL DEFAULT '[]',
        domain TEXT NOT NULL,
        condition TEXT NOT NULL,
        recommended_strategy TEXT NOT NULL,
        avoid_strategy TEXT,
        confidence REAL NOT NULL DEFAULT 0.5,
        success_rate REAL NOT NULL DEFAULT 0.5,
        sample_count INTEGER NOT NULL DEFAULT 1,
        is_generalization INTEGER NOT NULL DEFAULT 0,
        transfer_domains TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_learning_experiences_domain ON learning_experiences (domain, channel);
      CREATE INDEX IF NOT EXISTS idx_learning_experiences_timestamp ON learning_experiences (timestamp);
      CREATE INDEX IF NOT EXISTS idx_behavioral_rules_domain ON behavioral_adaptation_rules (domain);
      CREATE INDEX IF NOT EXISTS idx_behavioral_rules_confidence ON behavioral_adaptation_rules (confidence);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('learning_adaptation_milestone13', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 25,
    name: '025_general_reasoning_milestone14',
    up: `
      -- Reasoning Tasks (comprehensive tasks across deductive, inductive, abductive, analogical, probabilistic, abstract, mathematical, multi-step)
      CREATE TABLE IF NOT EXISTS reasoning_tasks (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        domain TEXT NOT NULL,
        primary_paradigm TEXT NOT NULL,
        premises TEXT NOT NULL DEFAULT '[]',
        steps TEXT NOT NULL DEFAULT '[]',
        final_conclusion TEXT NOT NULL,
        composite_confidence REAL NOT NULL,
        uncertainty_level REAL NOT NULL,
        argument_evaluation TEXT,
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_domain ON reasoning_tasks (domain);
      CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_paradigm ON reasoning_tasks (primary_paradigm);
      CREATE INDEX IF NOT EXISTS idx_reasoning_tasks_timestamp ON reasoning_tasks (timestamp);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('general_reasoning_milestone14', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 26,
    name: '026_causal_reasoning_milestone15',
    up: `
      -- Causal Graph Models (directed causal models across domains, representing nodes and causal links)
      CREATE TABLE IF NOT EXISTS causal_graph_models (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        nodes TEXT NOT NULL DEFAULT '[]',
        links TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL
      );

      -- Causal Interventions (empirical do-calculus interventions recording controlled perturbations and effects)
      CREATE TABLE IF NOT EXISTS causal_interventions (
        id TEXT PRIMARY KEY,
        graph_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        intervention_value TEXT NOT NULL,
        observed_effect_node_id TEXT NOT NULL,
        observed_effect_value TEXT NOT NULL,
        did_effect_change INTEGER NOT NULL DEFAULT 0,
        inferred_causal_link INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        timestamp TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_causal_graph_domain ON causal_graph_models (domain);
      CREATE INDEX IF NOT EXISTS idx_causal_interventions_graph ON causal_interventions (graph_id);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('causal_reasoning_milestone15', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 27,
    name: '027_predictive_cognition_milestone16',
    up: `
      -- Cognitive Predictions (prospective probabilistic predictions across events, consequences, behavior, obstacles)
      CREATE TABLE IF NOT EXISTS cognitive_predictions (
        id TEXT PRIMARY KEY,
        domain TEXT NOT NULL,
        prediction_type TEXT NOT NULL,
        target_statement TEXT NOT NULL,
        predicted_probability REAL NOT NULL,
        confidence REAL NOT NULL,
        rationale TEXT NOT NULL,
        horizon_deadline TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        actual_outcome INTEGER,
        actual_outcome_notes TEXT,
        resolved_at TEXT,
        prediction_error REAL,
        brier_score REAL
      );

      CREATE INDEX IF NOT EXISTS idx_cognitive_predictions_domain ON cognitive_predictions (domain);
      CREATE INDEX IF NOT EXISTS idx_cognitive_predictions_status ON cognitive_predictions (status);
      CREATE INDEX IF NOT EXISTS idx_cognitive_predictions_deadline ON cognitive_predictions (horizon_deadline);
      CREATE INDEX IF NOT EXISTS idx_cognitive_predictions_created ON cognitive_predictions (created_at);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('predictive_cognition_milestone16', 1, CURRENT_TIMESTAMP);
    `,
  },
  {
    id: 28,
    name: '028_imagination_and_simulation_milestone17',
    up: `
      -- Simulation Scenarios (Hypothetical cognition, scenario generation, counterfactuals, creative hypotheticals)
      CREATE TABLE IF NOT EXISTS simulation_scenarios (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        baseline_context TEXT NOT NULL,
        counterfactual_premise_json TEXT,
        hypothetical_params_json TEXT NOT NULL DEFAULT '{}',
        branches_json TEXT NOT NULL DEFAULT '[]',
        uncertainty REAL NOT NULL,
        plausibility REAL NOT NULL,
        is_imagined INTEGER NOT NULL DEFAULT 1,
        is_episodic_memory INTEGER NOT NULL DEFAULT 0,
        recommended_action TEXT,
        insights_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_simulation_scenarios_type ON simulation_scenarios (type);
      CREATE INDEX IF NOT EXISTS idx_simulation_scenarios_created ON simulation_scenarios (created_at);

      -- Alternative Decisions (Evaluations of decision options through simulated outcomes)
      CREATE TABLE IF NOT EXISTS alternative_decisions (
        id TEXT PRIMARY KEY,
        decision_context TEXT NOT NULL,
        options_json TEXT NOT NULL DEFAULT '[]',
        selected_option_id TEXT NOT NULL,
        rationale TEXT NOT NULL,
        is_imagined INTEGER NOT NULL DEFAULT 1,
        is_episodic_memory INTEGER NOT NULL DEFAULT 0,
        evaluated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_alternative_decisions_evaluated ON alternative_decisions (evaluated_at);

      INSERT OR IGNORE INTO system_state_versions (component, version, updated_at)
      VALUES ('imagination_and_simulation_milestone17', 1, CURRENT_TIMESTAMP);
    `,
  },
];
