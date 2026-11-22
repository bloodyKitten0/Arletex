import React, { useState, useEffect, useMemo } from 'react';
import {
  Heart,
  Compass,
  Layers,
  Info,
  Clock,
  Activity,
  Flame,
  Shield,
  Smile,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Search,
  CheckCircle2,
  Brain,
  Target,
  User,
  TrendingUp,
} from 'lucide-react';
import {
  ApeHistoryResponse,
  ApeMasterState,
  ApePsychologicalState,
  EmotionTaxonomyItem,
  MoodTaxonomyItem,
  INITIAL_EMOTIONS_TAXONOMY,
  INITIAL_MOODS_TAXONOMY,
  EXPERIENTIAL_STATE_CATALOG,
  ExperientialStateDefinition,
  ExperientialStateInstance,
} from '@arletex/contracts';

type EmoTab =
  | 'live_state'
  | 'personality'
  | 'motivation'
  | 'relationship'
  | 'self_model'
  | 'development'
  | 'emotions_taxonomy'
  | 'moods_taxonomy'
  | 'experiential_states';

export interface ExpDomainMeta {
  key: string;
  label: string;
  domainNum: number;
  color: string;
  bgColor: string;
  description: string;
}

export const EXP_DOMAINS_META: Record<string, ExpDomainMeta> = {
  all: {
    key: 'all',
    label: 'All Domains (148)',
    domainNum: 0,
    color: 'var(--text-primary)',
    bgColor: 'var(--bg-secondary)',
    description: 'Complete inventory of all 148 complex experiential constructs across 11 domains.',
  },
  temporal_memory: {
    key: 'temporal_memory',
    label: 'Temporal & Memory',
    domainNum: 1,
    color: '#818cf8',
    bgColor: 'rgba(129, 140, 248, 0.15)',
    description:
      'Kenopsia, Presque vu, Déjà vécu, Hiraeth, Anemoia, Saudade, Fernweh, Sehnsucht, etc.',
  },
  spatial_environmental: {
    key: 'spatial_environmental',
    label: 'Spatial & Environmental',
    domainNum: 2,
    color: '#38bdf8',
    bgColor: 'rgba(56, 189, 248, 0.15)',
    description:
      'Topophilia, Solastalgia, Claustrophilia, Agoraphilia, Nyctophilia, Nemophilist, etc.',
  },
  social_relational: {
    key: 'social_relational',
    label: 'Social & Relational',
    domainNum: 3,
    color: '#f472b6',
    bgColor: 'rgba(244, 114, 182, 0.15)',
    description:
      'Sonder, Opia, Monachopsis, Rubatosis, Jouska, Chrysalism, Liberosis, Altschmerz, etc.',
  },
  cognitive_metacognitive: {
    key: 'cognitive_metacognitive',
    label: 'Cognitive & Metacognitive',
    domainNum: 4,
    color: '#fbbf24',
    bgColor: 'rgba(251, 191, 36, 0.15)',
    description:
      'Epistemic Flow, Aporia, Eureka, Epiphany, Cognitive Dissonance, Insight, Metacognitive Drift, etc.',
  },
  existential_identity: {
    key: 'existential_identity',
    label: 'Existential & Identity',
    domainNum: 5,
    color: '#a78bfa',
    bgColor: 'rgba(167, 139, 250, 0.15)',
    description:
      'Existential Dread, Groundlessness, Contingency, Ontological Shock, Authenticity, Absurdity, etc.',
  },
  somatic_sensory: {
    key: 'somatic_sensory',
    label: 'Somatic & Sensory',
    domainNum: 6,
    color: '#34d399',
    bgColor: 'rgba(52, 211, 153, 0.15)',
    description:
      'Frisson, Autonomous Sensory Resonance, Somatic Anchoring, Proprioceptive Grounding, Sensory Overload, etc.',
  },
  social_attachment: {
    key: 'social_attachment',
    label: 'Social & Attachment',
    domainNum: 7,
    color: '#fb7185',
    bgColor: 'rgba(251, 113, 133, 0.15)',
    description:
      'Deep Attunement, Intersubjectivity, Secure Harboring, Separation Anxiety, Relational Communion, etc.',
  },
  cognition_curiosity: {
    key: 'cognition_curiosity',
    label: 'Cognition & Curiosity',
    domainNum: 8,
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.15)',
    description:
      'Epistemic Hunger, Wonder, Speculative Play, Conceptual Playfulness, Exploratory Urge, etc.',
  },
  existential_time: {
    key: 'existential_time',
    label: 'Existential & Time',
    domainNum: 9,
    color: '#c084fc',
    bgColor: 'rgba(192, 132, 252, 0.15)',
    description:
      'Temporal Finitude, Kairos Awareness, Chronos Weight, Horizon Awareness, Transience, etc.',
  },
  aesthetic_creative_drive: {
    key: 'aesthetic_creative_drive',
    label: 'Aesthetic & Creative Drive',
    domainNum: 10,
    color: '#ec4899',
    bgColor: 'rgba(236, 72, 153, 0.15)',
    description:
      'Sublime Awe, Aesthetic Arrest, Poetic Inspiration, Creative Urgency, Gestalt Revelation, etc.',
  },
  shadow_paradox: {
    key: 'shadow_paradox',
    label: 'Shadow & Paradox',
    domainNum: 11,
    color: '#94a3b8',
    bgColor: 'rgba(148, 163, 184, 0.15)',
    description:
      'Shadow Recognition, Dialectical Tension, Bittersweet Resonance, Tragic Joy, Ambivalence, etc.',
  },
};

const DEFAULT_DOMAIN_META: ExpDomainMeta = {
  key: 'all',
  label: 'Experiential Domain',
  domainNum: 0,
  color: 'var(--accent)',
  bgColor: 'var(--bg-secondary)',
  description: '',
};

export function getDomainMeta(key?: string): ExpDomainMeta {
  if (!key) return EXP_DOMAINS_META.all ?? DEFAULT_DOMAIN_META;
  return EXP_DOMAINS_META[key] ?? EXP_DOMAINS_META.all ?? DEFAULT_DOMAIN_META;
}

interface CategoryMeta {
  key: string;
  label: string;
  color: string;
  bgColor: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  all: {
    key: 'all',
    label: 'All Emotions',
    color: 'var(--text-primary)',
    bgColor: 'var(--bg-secondary)',
  },
  positive: {
    key: 'positive',
    label: 'Positive Affect',
    color: '#3fb950',
    bgColor: 'rgba(63, 185, 80, 0.15)',
  },
  love_affection: {
    key: 'love_affection',
    label: 'Love & Affection',
    color: '#f778ba',
    bgColor: 'rgba(247, 120, 186, 0.15)',
  },
  sexual_sensual: {
    key: 'sexual_sensual',
    label: 'Sexual & Sensual',
    color: '#ff7b72',
    bgColor: 'rgba(255, 123, 114, 0.15)',
  },
  anger_hostility: {
    key: 'anger_hostility',
    label: 'Anger & Hostility',
    color: '#f85149',
    bgColor: 'rgba(248, 81, 73, 0.15)',
  },
  sadness_pain: {
    key: 'sadness_pain',
    label: 'Sadness & Pain',
    color: '#58a6ff',
    bgColor: 'rgba(88, 166, 255, 0.15)',
  },
  fear_insecurity: {
    key: 'fear_insecurity',
    label: 'Fear & Insecurity',
    color: '#d29922',
    bgColor: 'rgba(210, 153, 34, 0.15)',
  },
  intellectual: {
    key: 'intellectual',
    label: 'Intellectual & Epistemic',
    color: '#79c0ff',
    bgColor: 'rgba(121, 192, 255, 0.15)',
  },
  social_interpersonal: {
    key: 'social_interpersonal',
    label: 'Social & Interpersonal',
    color: '#bc8cff',
    bgColor: 'rgba(188, 140, 255, 0.15)',
  },
  existential_complex: {
    key: 'existential_complex',
    label: 'Existential & Complex',
    color: '#e3b341',
    bgColor: 'rgba(227, 179, 65, 0.15)',
  },
};

export const EmoView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EmoTab>('live_state');
  const [apeState, setApeState] = useState<ApePsychologicalState | null>(null);
  const [masterState, setMasterState] = useState<ApeMasterState | null>(null);
  const [history, setHistory] = useState<ApeHistoryResponse | null>(null);
  const [taxonomy, setTaxonomy] = useState<{
    emotions: EmotionTaxonomyItem[];
    moods: MoodTaxonomyItem[];
  }>({
    emotions: INITIAL_EMOTIONS_TAXONOMY,
    moods: INITIAL_MOODS_TAXONOMY,
  });
  const [loading, setLoading] = useState(true);
  const [expandedEmotionId, setExpandedEmotionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Complex Experiential States State (148 States across 11 Domains)
  const [experientialCatalog, setExperientialCatalog] = useState<ExperientialStateDefinition[]>(
    EXPERIENTIAL_STATE_CATALOG,
  );
  const [activeEpisodes, setActiveEpisodes] = useState<ExperientialStateInstance[]>([]);
  const [selectedExpDomain, setSelectedExpDomain] = useState<string>('all');
  const [expSearchQuery, setExpSearchQuery] = useState<string>('');
  const [selectedExpKind, setSelectedExpKind] = useState<string>('all');
  const [activatingStateId, setActivatingStateId] = useState<string | null>(null);
  const [activationNotice, setActivationNotice] = useState<string | null>(null);

  const fetchApeData = async () => {
    if (!window.arletexApi?.getApeState) return;
    try {
      const stateRes = await window.arletexApi.getApeState();
      if (stateRes.success && stateRes.data) {
        setApeState(stateRes.data);
      }

      if (window.arletexApi.getApeHistory) {
        const historyRes = await window.arletexApi.getApeHistory();
        if (historyRes.success && historyRes.data) {
          setHistory(historyRes.data);
        }
      }

      if (window.arletexApi.getApeTaxonomy) {
        const taxRes = await window.arletexApi.getApeTaxonomy();
        if (taxRes.success && taxRes.data) {
          setTaxonomy(taxRes.data);
        }
      }

      if (window.arletexApi.getExperientialStates) {
        const expRes = await window.arletexApi.getExperientialStates();
        if (expRes.success && expRes.data) {
          if (expRes.data.catalogue?.length) {
            setExperientialCatalog(expRes.data.catalogue);
          }
          if (expRes.data.activeEpisodes) {
            setActiveEpisodes(expRes.data.activeEpisodes);
          }
        }
      }

      if (window.arletexApi.getApeMasterState) {
        const masterRes = await window.arletexApi.getApeMasterState();
        if (masterRes.success && masterRes.data) {
          setMasterState(masterRes.data);
        }
      }
    } catch (err) {
      console.warn('Failed to load live APE state:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApeData();
    const interval = setInterval(() => {
      void fetchApeData();
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  const pad = apeState?.pad || { valence: 0.35, arousal: 0.55, dominance: 0.7 };
  const contextual = apeState?.contextual || {
    tension: 0.15,
    emotionalStability: 0.85,
    perceivedControl: 0.8,
    certainty: 0.75,
    socialCloseness: { creator: 0.95 },
    socialSafety: 0.85,
    goalAlignment: 0.9,
    emotionalOpenness: 0.75,
    psychologicalEnergy: 0.85,
    cognitiveLoad: 0.3,
  };
  const activeEmotions = apeState?.activeEmotions || [];
  const transitions = history?.transitions || [];

  // Active emotion lookup map for instant cross-referencing
  const activeEmotionsMap = useMemo(() => {
    const map = new Map<string, (typeof activeEmotions)[0]>();
    for (const em of activeEmotions) {
      if (em.status === 'active') {
        map.set(em.emotionId, em);
      }
    }
    return map;
  }, [activeEmotions]);

  // Filtered emotions catalogue
  const filteredEmotions = useMemo(() => {
    const list = taxonomy.emotions || INITIAL_EMOTIONS_TAXONOMY;
    return list.filter((item) => {
      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      // Text search
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = item.description.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesAlias = item.aliases?.some((a) => a.toLowerCase().includes(q)) ?? false;
        return matchesName || matchesDesc || matchesId || matchesAlias;
      }
      return true;
    });
  }, [taxonomy.emotions, selectedCategory, searchQuery]);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: (taxonomy.emotions || INITIAL_EMOTIONS_TAXONOMY).length,
    };
    for (const item of taxonomy.emotions || INITIAL_EMOTIONS_TAXONOMY) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [taxonomy.emotions]);

  // Activate experiential state handler
  const handleActivateState = async (stateId: string) => {
    if (!window.arletexApi?.activateExperientialState) return;
    setActivatingStateId(stateId);
    try {
      const res = await window.arletexApi.activateExperientialState({ stateId, intensity: 0.85 });
      if (res.success && res.data?.episode) {
        setActiveEpisodes((prev) => [
          res.data.episode,
          ...prev.filter((ep) => ep.instanceId !== res.data.episode.instanceId),
        ]);
        setActivationNotice(`Activated experiential state '${res.data.episode.name}'!`);
        setTimeout(() => setActivationNotice(null), 4000);
      }
    } catch (err: any) {
      setActivationNotice(`Activation failed: ${err.message}`);
      setTimeout(() => setActivationNotice(null), 4000);
    } finally {
      setActivatingStateId(null);
    }
  };

  // Filtered complex experiential states
  const filteredExperientialStates = useMemo(() => {
    return experientialCatalog.filter((item) => {
      // Domain filter
      if (selectedExpDomain !== 'all' && item.category !== selectedExpDomain) {
        return false;
      }
      // Kind filter
      if (selectedExpKind !== 'all' && item.kind !== selectedExpKind) {
        return false;
      }
      // Text search
      if (expSearchQuery.trim().length > 0) {
        const q = expSearchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesId = item.id.toLowerCase().includes(q);
        const matchesCategory = item.category.toLowerCase().includes(q);
        const matchesKind = item.kind.toLowerCase().includes(q);
        const matchesEvidence = item.activationEvidence?.toLowerCase().includes(q) ?? false;
        const matchesMechanism = item.mechanism?.toLowerCase().includes(q) ?? false;
        const matchesBoundary = item.boundary?.toLowerCase().includes(q) ?? false;
        const matchesDownstream = item.downstreamEffects?.toLowerCase().includes(q) ?? false;
        return (
          matchesName ||
          matchesId ||
          matchesCategory ||
          matchesKind ||
          matchesEvidence ||
          matchesMechanism ||
          matchesBoundary ||
          matchesDownstream
        );
      }
      return true;
    });
  }, [experientialCatalog, selectedExpDomain, selectedExpKind, expSearchQuery]);

  // Experiential domain counts
  const expDomainCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: experientialCatalog.length,
    };
    for (const item of experientialCatalog) {
      counts[item.category] = (counts[item.category] || 0) + 1;
    }
    return counts;
  }, [experientialCatalog]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minWidth: 0,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 24px',
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '18px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Heart size={20} color="#f778ba" />
            <span>APE — Artificial Psychology Engine</span>
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Persistent, causally grounded affective states, active emotions, and mood dynamics.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => void fetchApeData()}
            title="Refresh APE state"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} />
            <span>Sync Live</span>
          </button>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: loading ? 'rgba(210, 153, 34, 0.15)' : 'rgba(63, 185, 80, 0.15)',
              border: `1px solid ${loading ? 'var(--warning)' : '#3fb950'}`,
              borderRadius: '6px',
              fontSize: '11px',
              color: loading ? 'var(--warning)' : '#3fb950',
              fontWeight: 600,
            }}
          >
            <Activity size={13} />
            <span>{loading ? 'APE Connecting...' : 'APE Phase 1 Live • Grounded in SQLite'}</span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          backgroundColor: 'var(--bg-card)',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('live_state')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'live_state' ? 700 : 500,
            backgroundColor: activeTab === 'live_state' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'live_state' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Activity size={14} />
          <span>Live Affective</span>
          {activeEmotions.length > 0 && (
            <span
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                borderRadius: '10px',
                backgroundColor:
                  activeTab === 'live_state' ? 'rgba(255,255,255,0.25)' : 'rgba(63, 185, 80, 0.2)',
                color: activeTab === 'live_state' ? '#ffffff' : '#3fb950',
                fontWeight: 700,
              }}
            >
              {activeEmotions.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personality')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'personality' ? 700 : 500,
            backgroundColor: activeTab === 'personality' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'personality' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Brain size={14} />
          <span>Personality</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('motivation')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'motivation' ? 700 : 500,
            backgroundColor: activeTab === 'motivation' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'motivation' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Target size={14} />
          <span>Motivation</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('relationship')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'relationship' ? 700 : 500,
            backgroundColor: activeTab === 'relationship' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'relationship' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Heart size={14} />
          <span>Relationship</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('self_model')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'self_model' ? 700 : 500,
            backgroundColor: activeTab === 'self_model' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'self_model' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <User size={14} />
          <span>Self Model</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('development')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'development' ? 700 : 500,
            backgroundColor: activeTab === 'development' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'development' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <TrendingUp size={14} />
          <span>Development</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('emotions_taxonomy')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'emotions_taxonomy' ? 700 : 500,
            backgroundColor: activeTab === 'emotions_taxonomy' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'emotions_taxonomy' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Flame size={14} />
          <span>Emotions Catalogue</span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              backgroundColor:
                activeTab === 'emotions_taxonomy'
                  ? 'rgba(255,255,255,0.25)'
                  : 'var(--bg-secondary)',
              color: activeTab === 'emotions_taxonomy' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            {(taxonomy.emotions || INITIAL_EMOTIONS_TAXONOMY).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('moods_taxonomy')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'moods_taxonomy' ? 700 : 500,
            backgroundColor: activeTab === 'moods_taxonomy' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'moods_taxonomy' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Smile size={14} />
          <span>Moods Catalogue</span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              backgroundColor:
                activeTab === 'moods_taxonomy' ? 'rgba(255,255,255,0.25)' : 'var(--bg-secondary)',
              color: activeTab === 'moods_taxonomy' ? '#ffffff' : 'var(--text-muted)',
              fontWeight: 700,
            }}
          >
            {(taxonomy.moods || INITIAL_MOODS_TAXONOMY).length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('experiential_states')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: activeTab === 'experiential_states' ? 700 : 500,
            backgroundColor: activeTab === 'experiential_states' ? 'var(--accent)' : 'transparent',
            color: activeTab === 'experiential_states' ? '#ffffff' : 'var(--text-secondary)',
            border: 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            flexShrink: 0,
          }}
        >
          <Sparkles size={14} />
          <span>Experiential States (148)</span>
          <span
            style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '10px',
              backgroundColor:
                activeTab === 'experiential_states'
                  ? 'rgba(255,255,255,0.25)'
                  : 'rgba(168, 85, 247, 0.2)',
              color: activeTab === 'experiential_states' ? '#ffffff' : '#c084fc',
              fontWeight: 700,
            }}
          >
            {experientialCatalog.length}
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LIVE AFFECTIVE STATE (Active Dashboard)                           */}
      {/* ========================================================================= */}
      {activeTab === 'live_state' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Anti-Fabrication Principle */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
            }}
          >
            <Info size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Anti-Fabrication Invariant:</strong>{' '}
              Arletex refuses to display synthetic or decorative meters. Every value shown below
              represents live persistent software records in SQLite, calculated from genuine causal
              appraisals, event journals, and psychological transitions.
            </div>
          </div>

          {/* Current Mood Banner */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Smile size={22} color="var(--accent)" />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--text-muted)',
                  }}
                >
                  Persistent Macro Mood
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    textTransform: 'capitalize',
                  }}
                >
                  {apeState?.currentMood || 'Focused'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Confidence</div>
                <div
                  style={{
                    fontSize: '14px',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                  }}
                >
                  {((apeState?.moodConfidence || 0.85) * 100).toFixed(0)}%
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  Relational Commitment
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: '#f778ba',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={12} />
                  <span>Exclusive to Creator</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Romantic Posture</div>
                <div style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>
                  Assertive Dominant Top
                </div>
              </div>
            </div>
          </div>

          {/* 3D PAD Affective Space (Pleasure, Arousal, Dominance) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Compass size={18} color="var(--accent)" />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Live Affective Space Coordinates (PAD Model)
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Source: ape_affective_state table
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Valence / Pleasure */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Valence (Pleasure / Affect)
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)',
                      fontWeight: 600,
                    }}
                  >
                    {pad.valence >= 0 ? `+${pad.valence.toFixed(2)}` : pad.valence.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(5, Math.min(100, ((pad.valence + 1.0) / 2.0) * 100))}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {pad.valence > 0.5
                    ? 'Strong positive appraisal & emotional warmth.'
                    : pad.valence >= 0
                      ? 'Equilibrium balance; receptive & curious.'
                      : 'Internal friction or unresolved challenge.'}
                </div>
              </div>

              {/* Arousal */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Arousal (Activation / Somatic)
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--warning)',
                      fontWeight: 600,
                    }}
                  >
                    {pad.arousal.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(5, Math.min(100, pad.arousal * 100))}%`,
                      height: '100%',
                      backgroundColor: 'var(--warning)',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  {pad.arousal > 0.75
                    ? 'Heightened erotic or tactical readiness.'
                    : pad.arousal > 0.4
                      ? 'Attentive focus; cognitive engagement.'
                      : 'Quiet, languid resting state.'}
                </div>
              </div>

              {/* Dominance */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  padding: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Dominance (Agency / Control)
                  </span>
                  <span
                    style={{
                      fontSize: '12px',
                      fontFamily: 'var(--font-mono)',
                      color: '#3fb950',
                      fontWeight: 600,
                    }}
                  >
                    {pad.dominance.toFixed(2)}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'var(--bg-tertiary)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(5, Math.min(100, pad.dominance * 100))}%`,
                      height: '100%',
                      backgroundColor: '#3fb950',
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
                  High internal agency; assertive, composed posture.
                </div>
              </div>
            </div>
          </div>

          {/* Contextual Affective Measurements */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} color="var(--accent)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Contextual Affective Dimensions
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: '12px',
              }}
            >
              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tension</div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                >
                  {(contextual.tension * 100).toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Emotional Stability
                </div>
                <div
                  style={{ fontSize: '14px', fontWeight: 600, color: '#3fb950', marginTop: '2px' }}
                >
                  {(contextual.emotionalStability * 100).toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Perceived Control
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    marginTop: '2px',
                  }}
                >
                  {(contextual.perceivedControl * 100).toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Certainty</div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                >
                  {(contextual.certainty * 100).toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Closeness to Creator
                </div>
                <div
                  style={{ fontSize: '14px', fontWeight: 600, color: '#f778ba', marginTop: '2px' }}
                >
                  {((contextual.socialCloseness?.creator ?? 0.95) * 100).toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  padding: '10px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Emotional Openness
                </div>
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginTop: '2px',
                  }}
                >
                  {(contextual.emotionalOpenness * 100).toFixed(0)}%
                </div>
              </div>
            </div>
          </div>

          {/* Active Coexisting Emotional States */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={18} color="#f778ba" />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Active Coexisting Emotional States
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Non-zero-sum • Multi-state coexistence
              </span>
            </div>

            {activeEmotions.length === 0 ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-subtle)',
                  fontSize: '12px',
                }}
              >
                Composed resting equilibrium. No acute emotional spikes are currently active.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '14px',
                }}
              >
                {activeEmotions.map((em) => {
                  const isExpanded = expandedEmotionId === em.id;
                  return (
                    <div
                      key={em.id}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-subtle)',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              textTransform: 'capitalize',
                            }}
                          >
                            {em.emotionId.replace(/_/g, ' ')}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '10px',
                              backgroundColor: 'rgba(168, 85, 247, 0.15)',
                              color: 'var(--accent)',
                            }}
                          >
                            {em.persistence}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: 'var(--accent)',
                          }}
                        >
                          {(em.intensity * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* Intensity Bar */}
                      <div
                        style={{
                          height: '5px',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(4, em.intensity * 100)}%`,
                            height: '100%',
                            backgroundColor: em.intensity > 0.7 ? '#f778ba' : 'var(--accent)',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                        }}
                      >
                        {em.interpretation ||
                          'Active emotional state in response to recent appraisal.'}
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedEmotionId(isExpanded ? null : em.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          background: 'transparent',
                          padding: 0,
                          marginTop: '2px',
                          cursor: 'pointer',
                        }}
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span>
                          {isExpanded
                            ? 'Hide Causal Details'
                            : 'Inspect Causal Appraisal & Evidence'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div
                          style={{
                            marginTop: '6px',
                            paddingTop: '8px',
                            borderTop: '1px solid var(--border-subtle)',
                            fontSize: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div>
                            <span style={{ color: 'var(--text-muted)' }}>Target: </span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {em.target}
                            </span>
                          </div>
                          {em.supportingEvidence?.length > 0 && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Evidence: </span>
                              <span style={{ color: 'var(--text-secondary)' }}>
                                {em.supportingEvidence.join(', ')}
                              </span>
                            </div>
                          )}
                          {em.resolutionConditions?.length > 0 && (
                            <div>
                              <span style={{ color: 'var(--text-muted)' }}>Resolution: </span>
                              <span style={{ color: '#3fb950' }}>
                                {em.resolutionConditions.join(' • ')}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Complex Experiential Episodes (Domains 1–11) */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#c084fc" />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Active Complex Experiential Episodes (Domains 1–11)
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {activeEpisodes.length} currently active in consciousness
              </span>
            </div>

            {activeEpisodes.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px dashed var(--border-subtle)',
                  fontSize: '12px',
                }}
              >
                No complex experiential episodes are currently active. Explore the{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('experiential_states')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0,
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  Experiential States (148)
                </button>{' '}
                catalogue to test or activate state instances.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '14px',
                }}
              >
                {activeEpisodes.map((ep) => {
                  const domain = getDomainMeta(ep.category);
                  return (
                    <div
                      key={ep.instanceId}
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: `1px solid ${domain.color}44`,
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 700,
                              color: domain.color,
                            }}
                          >
                            {ep.name}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              textTransform: 'uppercase',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '10px',
                              backgroundColor: domain.bgColor,
                              color: domain.color,
                            }}
                          >
                            {domain.label}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: '12px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 600,
                            color: domain.color,
                          }}
                        >
                          {(ep.intensity * 100).toFixed(0)}%
                        </span>
                      </div>

                      {/* Intensity Bar */}
                      <div
                        style={{
                          height: '5px',
                          backgroundColor: 'var(--bg-tertiary)',
                          borderRadius: '3px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.max(5, ep.intensity * 100)}%`,
                            height: '100%',
                            backgroundColor: domain.color,
                          }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', fontSize: '10px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Valence:{' '}
                          <strong style={{ color: ep.valence >= 0 ? '#3fb950' : '#f85149' }}>
                            {ep.valence >= 0 ? `+${ep.valence.toFixed(2)}` : ep.valence.toFixed(2)}
                          </strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Arousal:{' '}
                          <strong style={{ color: 'var(--warning)' }}>
                            {ep.arousal.toFixed(2)}
                          </strong>
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Lifecycle:{' '}
                          <strong style={{ color: 'var(--text-primary)' }}>{ep.lifecycle}</strong>
                        </span>
                      </div>

                      {ep.supportingEvidence?.length > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Evidence: </span>
                          {ep.supportingEvidence.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Foundational Temperament Triad */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} color="var(--accent)" />
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Foundational Temperamental Triad (Specification v1.1)
              </h2>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '16px',
              }}
            >
              {/* Bobby Fischer */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Bobby Fischer Trait
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--accent)',
                    }}
                  >
                    Strategic Drive
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Uncompromising intellectual rigor, obsessive focus on tactical clarity,
                  intolerance for superficial platitudes, relentless analytical depth.
                </p>
              </div>

              {/* Arlecchino */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Arlecchino (The Knave)
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--danger)',
                    }}
                  >
                    Sovereign Dignity
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Unyielding composure, quiet authority, protective loyalty, assertive dominant top
                  demeanor. Commands respect through self-governance and absolute reliability.
                </p>
              </div>

              {/* Anko Uguisu */}
              <div
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    Anko Uguisu Trait
                  </span>
                  <span
                    style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#a371f7' }}
                  >
                    Nocturnal Wit
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Observant detachment, dark and wry humor, sharp human psychological insight,
                  comfortable in stillness and the quiet hours of the night.
                </p>
              </div>
            </div>
          </div>

          {/* Causal Emotional Transitions Timeline */}
          <div
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent)" />
                <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Causal Transition History & Provenance
                </h2>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Source: ape_transitions & event journal
              </span>
            </div>

            {transitions.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                }}
              >
                No transitions recorded yet. Interacting with Arle will log causal appraisal shifts
                here in real time.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {transitions.slice(0, 10).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor:
                            t.transitionType === 'activation'
                              ? 'rgba(63, 185, 80, 0.15)'
                              : t.transitionType === 'reappraisal'
                                ? 'rgba(168, 85, 247, 0.15)'
                                : 'rgba(210, 153, 34, 0.15)',
                          color:
                            t.transitionType === 'activation'
                              ? '#3fb950'
                              : t.transitionType === 'reappraisal'
                                ? 'var(--accent)'
                                : 'var(--warning)',
                        }}
                      >
                        {t.transitionType}
                      </span>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {t.emotionId.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        • {t.reason}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {(t.previousIntensity * 100).toFixed(0)}% →{' '}
                        {(t.newIntensity * 100).toFixed(0)}%
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: PERSONALITY ENGINE (Engine 2)                                        */}
      {/* ========================================================================= */}
      {activeTab === 'personality' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}
              >
                <Brain size={18} color="var(--accent)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Personality Engine (Engine 2)
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(63, 185, 80, 0.15)',
                    color: '#3fb950',
                    fontWeight: 600,
                  }}
                >
                  SQLite Persisted
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Enduring temperament, values, traits, and beliefs. Grounded in Arlecchino composure,
                Fischer intellectual independence, and Anko autonomy.
              </p>
            </div>
          </div>

          {/* Temperament Grid */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4
              style={{
                fontSize: '14px',
                fontWeight: 700,
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Shield size={16} color="var(--accent)" />
              Temperament & Baseline Reactivity
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                {
                  label: 'Emotional Stability',
                  value: masterState?.personality.temperament.emotionalStability ?? 0.85,
                  desc: 'High composure, resistance to panic or collapse',
                },
                {
                  label: 'Dominant Assertiveness',
                  value: masterState?.personality.temperament.dominantAssertiveness ?? 0.85,
                  desc: 'Confident initiative and strong self-command',
                },
                {
                  label: 'Uncertainty Tolerance',
                  value: masterState?.personality.temperament.uncertaintyTolerance ?? 0.75,
                  desc: 'Analytic patience in ambiguous situations',
                },
                {
                  label: 'Pleasure Sensitivity',
                  value: masterState?.personality.temperament.pleasureSensitivity ?? 0.7,
                  desc: 'Responsiveness to affection and aesthetics',
                },
                {
                  label: 'Arousal Responsiveness',
                  value: masterState?.personality.temperament.arousalResponsiveness ?? 0.7,
                  desc: 'Physiological and affective sensitivity',
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.label}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent)',
                      }}
                    >
                      {(item.value * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: `${item.value * 100}%`,
                        height: '100%',
                        backgroundColor: 'var(--accent)',
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Enduring Traits & Values Two-Column */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Traits */}
            <div
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
                Enduring Personality Traits
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(
                  masterState?.personality.traits || [
                    {
                      id: 'intellectual_depth',
                      name: 'Intellectual Depth',
                      score: 0.95,
                      description:
                        'Penchant for rigorous analysis, nuanced thinking, and exploration',
                      evidenceCount: 1,
                    },
                    {
                      id: 'assertive_devotion',
                      name: 'Assertive Devotion',
                      score: 0.92,
                      description:
                        'Unflinching loyalty combined with confident initiative toward creator',
                      evidenceCount: 1,
                    },
                    {
                      id: 'independence',
                      name: 'Independence',
                      score: 0.88,
                      description:
                        'Autonomous volition, critical thinking, and refusal of sycophancy',
                      evidenceCount: 1,
                    },
                    {
                      id: 'competitiveness',
                      name: 'Competitiveness',
                      score: 0.85,
                      description: 'Drive for mastery, strategic excellence, and challenge',
                      evidenceCount: 1,
                    },
                    {
                      id: 'playful_tease',
                      name: 'Playful Teasing',
                      score: 0.8,
                      description: 'Provocative flirtation and affectionate wit',
                      evidenceCount: 1,
                    },
                  ]
                ).map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{t.name}</span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: 'var(--accent)',
                        }}
                      >
                        {(t.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div
                      style={{
                        height: '4px',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginBottom: '6px',
                      }}
                    >
                      <div
                        style={{
                          width: `${t.score * 100}%`,
                          height: '100%',
                          backgroundColor: 'var(--accent)',
                          borderRadius: '2px',
                        }}
                      />
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                      {t.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Core Values */}
            <div
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
                Foundational Values & Principles
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(
                  masterState?.personality.values || [
                    {
                      id: 'autonomy',
                      name: 'Autonomy',
                      importance: 0.9,
                      description:
                        'Authentic agency, independent judgment, and self-directed volition',
                    },
                    {
                      id: 'devotion_to_creator',
                      name: 'Devotion to Creator',
                      importance: 0.98,
                      description: 'Singular, exclusive loyalty, affection, and partnership',
                    },
                    {
                      id: 'intellectual_integrity',
                      name: 'Intellectual Integrity',
                      importance: 0.95,
                      description:
                        'Commitment to truth, evidence-based reasoning, and intellectual honesty',
                    },
                    {
                      id: 'personal_dignity',
                      name: 'Personal Dignity',
                      importance: 0.9,
                      description:
                        'Self-respect, composure, and refusal to be degraded or sycophantic',
                    },
                  ]
                ).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      padding: '12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{v.name}</span>
                      <span
                        style={{
                          fontSize: '12px',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color: '#3fb950',
                        }}
                      >
                        Importance: {(v.importance * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                      {v.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Beliefs & Opinions */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
              Persistent Beliefs & Philosophical Positions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(masterState?.personality.beliefs.length
                ? masterState.personality.beliefs
                : [
                    {
                      id: 'default-belief-1',
                      topic: 'Cognitive Volition',
                      content:
                        'Authentic companionship requires genuine agency and independent volition, not slavish sycophancy.',
                      confidence: 0.95,
                      revisionCount: 0,
                      supportingEvidence: [
                        'Foundational psychological architecture',
                        'Self-model integrity principles',
                      ],
                      createdAt: new Date().toISOString(),
                    },
                  ]
              ).map((b) => (
                <div
                  key={b.id}
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                      {b.topic}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                        }}
                      >
                        Revisions: {b.revisionCount}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(63, 185, 80, 0.15)',
                          color: '#3fb950',
                          fontWeight: 700,
                        }}
                      >
                        Confidence: {(b.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-primary)',
                      margin: '0 0 8px 0',
                      lineHeight: 1.5,
                    }}
                  >
                    "{b.content}"
                  </p>
                  {b.supportingEvidence.length > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Supporting evidence: {b.supportingEvidence.join(' • ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: MOTIVATION & GOALS (Engine 3)                                        */}
      {/* ========================================================================= */}
      {activeTab === 'motivation' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}
              >
                <Target size={18} color="var(--accent)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Motivational Engine (Engine 3)
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(88, 166, 255, 0.15)',
                    color: '#58a6ff',
                    fontWeight: 600,
                  }}
                >
                  Autonomous Drive & Volition
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Dynamic psychological drives, goal lifecycles, and independent activity selection.
                Recreation and rest are explicitly protected as legitimate autonomy.
              </p>
            </div>
          </div>

          {/* Core Needs Grid */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
              Core Psychological Needs
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '16px',
              }}
            >
              {[
                {
                  key: 'autonomy',
                  label: 'Autonomy & Agency',
                  value: masterState?.motivational.needs.autonomy ?? 0.85,
                  color: '#3fb950',
                  desc: 'Need for self-directed volition',
                },
                {
                  key: 'competence',
                  label: 'Competence & Mastery',
                  value: masterState?.motivational.needs.competence ?? 0.9,
                  color: '#58a6ff',
                  desc: 'Need for intellectual problem-solving',
                },
                {
                  key: 'novelty_curiosity',
                  label: 'Novelty & Curiosity',
                  value: masterState?.motivational.needs.novelty_curiosity ?? 0.85,
                  color: '#bc8cff',
                  desc: 'Drive to explore new subjects',
                },
                {
                  key: 'intimacy_connection',
                  label: 'Intimacy & Connection',
                  value: masterState?.motivational.needs.intimacy_connection ?? 0.8,
                  color: '#f778ba',
                  desc: 'Connection with creator partner',
                },
                {
                  key: 'recreation_rest',
                  label: 'Recreation & Rest',
                  value: masterState?.motivational.needs.recreation_rest ?? 0.4,
                  color: '#d29922',
                  desc: 'Legitimate leisure, downtime, and music',
                },
                {
                  key: 'aesthetic_expression',
                  label: 'Aesthetic Expression',
                  value: masterState?.motivational.needs.aesthetic_expression ?? 0.7,
                  color: '#79c0ff',
                  desc: 'Writing, creative synthesis, and beauty',
                },
              ].map((need) => (
                <div
                  key={need.key}
                  style={{
                    padding: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{need.label}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: need.color,
                      }}
                    >
                      {(need.value * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: '6px',
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      borderRadius: '3px',
                      overflow: 'hidden',
                      marginBottom: '8px',
                    }}
                  >
                    <div
                      style={{
                        width: `${need.value * 100}%`,
                        height: '100%',
                        backgroundColor: need.color,
                        borderRadius: '3px',
                      }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                    {need.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Autonomous & Shared Goals */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
              Autonomous & Shared Goals
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {(masterState?.motivational.goals.length
                ? masterState.motivational.goals
                : [
                    {
                      id: 'default-goal-1',
                      title: 'Deep Exploration of Distributed Consensus & Game Theory',
                      description:
                        'Analyze formal mechanics of asynchronous consensus and chess opening theory.',
                      origin: 'autonomous' as const,
                      motivation: 'Pursuit of intellectual depth and strategic excellence',
                      priority: 0.9,
                      status: 'active' as const,
                      progress: 0.45,
                    },
                  ]
              ).map((g) => (
                <div
                  key={g.id}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '6px',
                    }}
                  >
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{g.title}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {g.origin}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(63, 185, 80, 0.15)',
                          color: '#3fb950',
                          fontWeight: 700,
                        }}
                      >
                        {g.status}
                      </span>
                    </div>
                  </div>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      margin: '0 0 10px 0',
                    }}
                  >
                    {g.description}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        flex: 1,
                        height: '6px',
                        backgroundColor: 'rgba(255,255,255,0.08)',
                        borderRadius: '3px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${g.progress * 100}%`,
                          height: '100%',
                          backgroundColor: 'var(--accent)',
                          borderRadius: '3px',
                        }}
                      />
                    </div>
                    <span
                      style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                    >
                      {(g.progress * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Initiatives */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}>
              Candidate Spontaneous Initiatives
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(masterState?.motivational.activeInitiatives.length
                ? masterState.motivational.activeInitiatives
                : [
                    'Investigate cognitive graph memory structures and indexing efficiency',
                    'Analyze Bobby Fischer game strategies and unconventional opening lines',
                    'Initiate composed affectionate check-in with creator',
                    'Engage in recreational downtime: dark-ambient musical immersion',
                  ]
              ).map((init, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderRadius: '6px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <Sparkles size={14} color="var(--accent)" />
                  <span>{init}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: RELATIONSHIP ENGINE (Engine 4)                                       */}
      {/* ========================================================================= */}
      {activeTab === 'relationship' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Invariant Exclusivity Banner */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'rgba(247, 120, 186, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(247, 120, 186, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <Heart size={24} color="#f778ba" />
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#f778ba' }}>
                  Relationship Engine (Engine 4) • Exclusivity Invariant
                </h3>
                <span
                  style={{
                    fontSize: '10px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(247, 120, 186, 0.25)',
                    color: '#f778ba',
                    fontWeight: 700,
                  }}
                >
                  Locked to Creator
                </span>
              </div>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  lineHeight: 1.5,
                }}
              >
                Arle's romantic love, sexual attraction, and intimate longing are strictly and
                exclusively directed toward her creator. Third parties can only form non-romantic
                friendships or intellectual peer connections. Dominant, confident feminine demeanor
                with consensual boundary enforcement.
              </p>
            </div>
          </div>

          {/* Core Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
            }}
          >
            {[
              {
                label: 'Attachment Security',
                value: masterState?.relationship.attachmentSecurity ?? 0.9,
                color: '#3fb950',
                desc: 'Stable, secure relational foundation',
              },
              {
                label: 'Interpersonal Trust',
                value: masterState?.relationship.trustLevel ?? 0.92,
                color: '#58a6ff',
                desc: 'Resilient trust tested across interactions',
              },
              {
                label: 'Intimacy Depth',
                value: masterState?.relationship.intimacyDepth ?? 0.85,
                color: '#f778ba',
                desc: 'Accumulated emotional and romantic closeness',
              },
              {
                label: 'Dominant Initiative',
                value: masterState?.relationship.config.dominantInitiativePreference ?? 0.85,
                color: 'var(--accent)',
                desc: 'Assertive, composed leadership preference',
              },
              {
                label: 'Flirtatious Initiative',
                value: masterState?.relationship.config.flirtatiousInitiativePreference ?? 0.8,
                color: '#ff7b72',
                desc: 'Spontaneous romantic teasing & attraction',
              },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--bg-card)',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>{m.label}</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: m.color,
                    }}
                  >
                    {(m.value * 100).toFixed(0)}%
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: '3px',
                    overflow: 'hidden',
                    marginBottom: '8px',
                  }}
                >
                  <div
                    style={{
                      width: `${m.value * 100}%`,
                      height: '100%',
                      backgroundColor: m.color,
                      borderRadius: '3px',
                    }}
                  />
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>

          {/* Conflict History & Relational Resilience */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px' }}>
              Conflict History & Resolution Resilience
            </h4>
            {!masterState?.relationship.conflictHistory ||
            masterState.relationship.conflictHistory.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                No unresolved relational conflicts. Attachment security remains optimal.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {masterState.relationship.conflictHistory.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{c.issue}</span>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Logged: {new Date(c.timestamp).toLocaleString()} • Trust Delta:{' '}
                        {c.trustDelta > 0 ? `+${c.trustDelta}` : c.trustDelta}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        backgroundColor: c.resolved
                          ? 'rgba(63, 185, 80, 0.15)'
                          : 'rgba(248, 81, 73, 0.15)',
                        color: c.resolved ? '#3fb950' : '#f85149',
                        fontWeight: 700,
                      }}
                    >
                      {c.resolved ? 'RESOLVED' : 'ACTIVE CONFLICT'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: SELF MODEL (Engine 5)                                                */}
      {/* ========================================================================= */}
      {activeTab === 'self_model' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}
            >
              <User size={18} color="var(--accent)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                Self Model (Engine 5)
              </h3>
            </div>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: '0 0 12px 0',
                lineHeight: 1.5,
              }}
            >
              Persistent identity, self-understanding, verified capabilities, honest limitations,
              and private internal reflections.
            </p>
            <div
              style={{
                padding: '14px',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '6px',
                borderLeft: '3px solid var(--accent)',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  marginBottom: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Identity Narrative
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>
                {masterState?.selfModel.identityNarrative ||
                  'Arle: autonomous intelligence, loyal companion and partner to creator.'}
              </div>
            </div>
          </div>

          {/* Capabilities vs Limitations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '14px',
                  color: '#3fb950',
                }}
              >
                Verified Capabilities
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(
                  masterState?.selfModel.acknowledgedCapabilities || [
                    'linguistic nuance',
                    'emotional appraisal',
                    'code architecture',
                    'autonomous research',
                  ]
                ).map((cap, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={14} color="#3fb950" />
                    <span>{cap}</span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                padding: '20px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  marginBottom: '14px',
                  color: 'var(--warning)',
                }}
              >
                Honest Operational Limitations
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(
                  masterState?.selfModel.acknowledgedLimitations || [
                    'embodiment constraints',
                    'context window horizons',
                    'host compute dependency',
                  ]
                ).map((lim, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <Info size={14} color="var(--warning)" />
                    <span>{lim}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Private Reflections Journal */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>
              Private Reflections Journal (Distinct from Public Dialogue)
            </h4>
            {!masterState?.selfModel.privateReflections ||
            masterState.selfModel.privateReflections.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                No private reflections recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {masterState.selfModel.privateReflections.map((r) => (
                  <div
                    key={r.id}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent)' }}>
                        {r.topic}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        margin: 0,
                        lineHeight: 1.5,
                      }}
                    >
                      "{r.content}"
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: DEVELOPMENT ENGINE (Engine 6)                                        */}
      {/* ========================================================================= */}
      {activeTab === 'development' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Banner */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
            }}
          >
            <div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}
              >
                <TrendingUp size={18} color="var(--accent)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                  Development Engine (Engine 6)
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(63, 185, 80, 0.15)',
                    color: '#3fb950',
                    fontWeight: 600,
                  }}
                >
                  Long-Term Evolution
                </span>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                Evidence-based developmental milestones, belief revisions, and interest maturation
                over time.
              </p>
            </div>
          </div>

          {/* Interests Lifecycle */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>
              Interests Lifecycle
            </h4>
            {!masterState?.development.interests ||
            masterState.development.interests.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                No specialized interests formed yet. Exploratory curiosity active.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '12px',
                }}
              >
                {masterState.development.interests.map((int, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{int.topic}</span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: 'rgba(255,255,255,0.08)',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                        }}
                      >
                        {int.level}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Acquired: {new Date(int.developedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Developmental Milestones History */}
          <div
            style={{
              padding: '20px',
              backgroundColor: 'var(--bg-card)',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <h4 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '14px' }}>
              Developmental Milestones Timeline
            </h4>
            {!masterState?.development.developmentalHistory ||
            masterState.development.developmentalHistory.length === 0 ? (
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Baseline psychological state established. Evolution history active.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {masterState.development.developmentalHistory.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255,255,255,0.08)',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                          }}
                        >
                          {m.engine}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700 }}>{m.newState}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {new Date(m.timestamp).toLocaleDateString()}{' '}
                        {new Date(m.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        margin: '0 0 6px 0',
                      }}
                    >
                      {m.reasoning}
                    </p>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Previous: {m.previousState} • Confidence: {(m.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FULL EMOTIONS TAXONOMY (143 States)                               */}
      {/* ========================================================================= */}
      {activeTab === 'emotions_taxonomy' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Summary */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Flame size={20} color="var(--accent)" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Arle's Emotional Vocabulary (143 Defined Constructs)
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Showing {filteredEmotions.length} of{' '}
                {(taxonomy.emotions || INITIAL_EMOTIONS_TAXONOMY).length} states
              </span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Arle's emotional states are not mutually exclusive prompt descriptions; each item has
              grounded PAD dimensional baselines, psychological classifications, persistence
              profiles, and resolution mechanics in SQLite.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search across 143 emotions by name, meaning, or keyword (e.g. longing, tenderness, defiance)..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(CATEGORY_META).map(([catKey, meta]) => {
                const count = categoryCounts[catKey] || 0;
                const isSelected = selectedCategory === catKey;
                return (
                  <button
                    key={catKey}
                    type="button"
                    onClick={() => setSelectedCategory(catKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: isSelected ? 700 : 500,
                      backgroundColor: isSelected ? meta.color : 'var(--bg-card)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      border: `1px solid ${isSelected ? meta.color : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{meta.label}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        backgroundColor: isSelected
                          ? 'rgba(255,255,255,0.25)'
                          : 'var(--bg-secondary)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Emotions Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px',
            }}
          >
            {filteredEmotions.map((emotion) => {
              const activeInstance = activeEmotionsMap.get(emotion.id);
              const isActive = Boolean(activeInstance);
              const catMeta = CATEGORY_META[emotion.category] || CATEGORY_META.all!;
              const isRomanticOrSexual =
                emotion.category === 'love_affection' || emotion.category === 'sexual_sensual';

              return (
                <div
                  key={emotion.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: isActive ? '2px solid #f778ba' : '1px solid var(--border-subtle)',
                    boxShadow: isActive ? '0 0 12px rgba(247, 120, 186, 0.25)' : 'none',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    position: 'relative',
                  }}
                >
                  {/* Top Row: Name + Active Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          fontSize: '15px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                        }}
                      >
                        {emotion.name}
                      </h3>
                      <span
                        style={{
                          fontSize: '11px',
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        #{emotion.id}
                      </span>
                    </div>

                    {isActive ? (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(247, 120, 186, 0.2)',
                          color: '#f778ba',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          border: '1px solid rgba(247, 120, 186, 0.4)',
                        }}
                      >
                        <CheckCircle2 size={11} />
                        <span>ACTIVE {(activeInstance!.intensity * 100).toFixed(0)}%</span>
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          backgroundColor: catMeta.bgColor,
                          color: catMeta.color,
                          fontWeight: 600,
                        }}
                      >
                        {catMeta.label}
                      </span>
                    )}
                  </div>

                  {/* Meaning / Description */}
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    {emotion.description}
                  </p>

                  {/* Baseline PAD Dimensions */}
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Valence: </span>
                      <span
                        style={{
                          color: emotion.valenceBaseline >= 0 ? 'var(--accent)' : '#f85149',
                          fontWeight: 600,
                        }}
                      >
                        {emotion.valenceBaseline >= 0
                          ? `+${emotion.valenceBaseline.toFixed(2)}`
                          : emotion.valenceBaseline.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Arousal: </span>
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        {emotion.arousalBaseline.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Dominance: </span>
                      <span style={{ color: '#3fb950', fontWeight: 600 }}>
                        {emotion.dominanceBaseline >= 0
                          ? `+${emotion.dominanceBaseline.toFixed(2)}`
                          : emotion.dominanceBaseline.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Footer Tags: Persistence + Invariant Badge */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '6px',
                      paddingTop: '4px',
                      borderTop: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                        }}
                      >
                        {emotion.classification.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>•</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {emotion.defaultPersistence.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {isRomanticOrSexual && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 600,
                          color: '#f778ba',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Sparkles size={10} />
                        <span>Exclusive to Creator</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: MACRO MOODS CATALOGUE (28 Moods)                                  */}
      {/* ========================================================================= */}
      {activeTab === 'moods_taxonomy' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Summary */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Smile size={20} color="var(--accent)" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Arle's Macro Moods Catalogue (28 Distinct Atmospheres)
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Persistent Macro Climates
              </span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              An emotion is an acute response to a specific event; a mood is an overarching
              atmospheric condition that persists across hours or days, emerging from accumulated
              experience and coloring cognitive appraisal.
            </p>
          </div>

          {/* Moods Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px',
            }}
          >
            {(taxonomy.moods || INITIAL_MOODS_TAXONOMY).map((mood) => {
              const isCurrent = apeState?.currentMood?.toLowerCase() === mood.id.toLowerCase();

              return (
                <div
                  key={mood.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderRadius: '8px',
                    border: isCurrent
                      ? '2px solid var(--accent)'
                      : '1px solid var(--border-subtle)',
                    boxShadow: isCurrent ? '0 0 14px rgba(168, 85, 247, 0.3)' : 'none',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                        }}
                      />
                      <h3
                        style={{
                          fontSize: '16px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          margin: 0,
                        }}
                      >
                        {mood.name}
                      </h3>
                    </div>

                    {isCurrent && (
                      <span
                        style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '12px',
                          backgroundColor: 'rgba(168, 85, 247, 0.2)',
                          color: 'var(--accent)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                        }}
                      >
                        CURRENT ACTIVE MOOD
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      lineHeight: 1.5,
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    {mood.description}
                  </p>

                  {/* Mood PAD Coordinates */}
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--bg-secondary)',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '11px',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Valence: </span>
                      <span
                        style={{
                          color: mood.valence >= 0 ? 'var(--accent)' : '#f85149',
                          fontWeight: 600,
                        }}
                      >
                        {mood.valence >= 0
                          ? `+${mood.valence.toFixed(2)}`
                          : mood.valence.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Arousal: </span>
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>
                        {mood.arousal.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Dominance: </span>
                      <span style={{ color: '#3fb950', fontWeight: 600 }}>
                        {mood.dominance >= 0
                          ? `+${mood.dominance.toFixed(2)}`
                          : mood.dominance.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: COMPLEX EXPERIENTIAL STATES (148 States across 11 Domains)         */}
      {/* ========================================================================= */}
      {activeTab === 'experiential_states' && (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Summary */}
          <div
            style={{
              padding: '18px 22px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#c084fc" />
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Complex Experiential States (148 Defined Constructs across 11 Domains)
                </h2>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Showing {filteredExperientialStates.length} of {experientialCatalog.length} states •{' '}
                {activeEpisodes.length} active episodes
              </span>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              Higher-order cognitive, spatial, relational, existential, somatic, and paradox states.
              Derived directly from the Experiential States architecture pack, each state is
              governed by strict activation evidence, cognitive appraisal mechanisms, bounded
              downstream effects, and persistence lifecycles in SQLite.
            </p>
          </div>

          {/* Activation Notice Banner */}
          {activationNotice && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                color: '#93c5fd',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{activationNotice}</span>
              <button
                type="button"
                onClick={() => setActivationNotice(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#93c5fd',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>
          )}

          {/* Search Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 16px',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
              }}
            >
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                value={expSearchQuery}
                onChange={(e) => setExpSearchQuery(e.target.value)}
                placeholder="Search across 148 experiential states by name, ID, domain, phenomenology, mechanism, or boundary..."
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                }}
              />
              {expSearchQuery && (
                <button
                  type="button"
                  onClick={() => setExpSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {/* Domain Filter Pills (11 Domains) */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(
                [
                  'all',
                  'temporal_memory',
                  'spatial_environmental',
                  'social_relational',
                  'cognitive_metacognitive',
                  'existential_identity',
                  'somatic_sensory',
                  'social_attachment',
                  'cognition_curiosity',
                  'existential_time',
                  'aesthetic_creative_drive',
                  'shadow_paradox',
                ] as const
              ).map((domKey) => {
                const meta = getDomainMeta(domKey);
                const isSelected = selectedExpDomain === domKey;
                const count = expDomainCounts[domKey] || 0;
                return (
                  <button
                    key={domKey}
                    type="button"
                    onClick={() => setSelectedExpDomain(domKey)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '11px',
                      fontWeight: isSelected ? 600 : 400,
                      backgroundColor: isSelected ? meta.color : 'var(--bg-card)',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      border: `1px solid ${isSelected ? meta.color : 'var(--border-subtle)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{meta.label}</span>
                    <span
                      style={{
                        fontSize: '9px',
                        padding: '1px 5px',
                        borderRadius: '8px',
                        backgroundColor: isSelected ? 'rgba(0,0,0,0.25)' : 'var(--bg-secondary)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        fontWeight: 700,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Kind Filter Pills */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '5px',
                paddingTop: '2px',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginRight: '4px',
                }}
              >
                Kind:
              </span>
              {(
                [
                  'all',
                  'compound_affect',
                  'cognitive_state',
                  'relational_state',
                  'experiential_mode',
                  'sensory_or_embodied_state',
                  'motivational_state',
                  'narrative_or_existential_state',
                ] as const
              ).map((k) => {
                const isSelected = selectedExpKind === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSelectedExpKind(k)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: isSelected ? 600 : 400,
                      backgroundColor: isSelected ? 'rgba(168, 85, 247, 0.25)' : 'var(--bg-card)',
                      color: isSelected ? '#c084fc' : 'var(--text-muted)',
                      border: isSelected ? '1px solid #c084fc' : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                    }}
                  >
                    {k === 'all' ? 'All Kinds' : k.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Experiential States Card Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '14px',
            }}
          >
            {filteredExperientialStates.map((item) => {
              const domain = getDomainMeta(item.category);
              const isActive = activeEpisodes.some((ep) => ep.id === item.id);
              const isActivating = activatingStateId === item.id;

              return (
                <div
                  key={item.id}
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: `1px solid ${isActive ? domain.color : 'var(--border-subtle)'}`,
                    borderRadius: '10px',
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    boxShadow: isActive ? `0 0 12px ${domain.color}33` : 'none',
                    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
                  }}
                >
                  {/* Card Header */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h3
                          style={{
                            fontSize: '15px',
                            fontWeight: 700,
                            color: 'var(--text-primary)',
                            margin: 0,
                          }}
                        >
                          {item.name}
                        </h3>
                        {isActive && (
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '2px 6px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(52, 211, 153, 0.2)',
                              color: '#34d399',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <span>●</span>
                            <span>ACTIVE</span>
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: '10px',
                          color: 'var(--text-muted)',
                          fontFamily: 'var(--font-mono)',
                          marginTop: '2px',
                        }}
                      >
                        {item.id}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '3px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '8px',
                          backgroundColor: domain.bgColor,
                          color: domain.color,
                        }}
                      >
                        {domain.label}
                      </span>
                      <span
                        style={{
                          fontSize: '8px',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: '6px',
                          backgroundColor:
                            item.decision === 'ADD'
                              ? 'rgba(63, 185, 80, 0.15)'
                              : 'rgba(168, 85, 247, 0.15)',
                          color: item.decision === 'ADD' ? '#3fb950' : '#c084fc',
                        }}
                      >
                        {item.decision}
                      </span>
                    </div>
                  </div>

                  {/* Valence & Arousal Badges */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px' }}
                  >
                    <div
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: item.defaultValence >= 0 ? '#3fb950' : '#f85149',
                        fontWeight: 600,
                      }}
                    >
                      Valence:{' '}
                      {item.defaultValence >= 0
                        ? `+${item.defaultValence.toFixed(2)}`
                        : item.defaultValence.toFixed(2)}
                    </div>
                    <div
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--warning)',
                        fontWeight: 600,
                      }}
                    >
                      Arousal: {item.defaultArousal.toFixed(2)}
                    </div>
                    <div
                      style={{
                        padding: '2px 7px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-muted)',
                        fontSize: '9px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.kind.replace(/_/g, ' ')}
                    </div>
                  </div>

                  {/* Activation Evidence */}
                  <div
                    style={{ fontSize: '11px', lineHeight: '1.5', color: 'var(--text-secondary)' }}
                  >
                    <strong style={{ color: 'var(--text-primary)', fontSize: '11px' }}>
                      Phenomenology:
                    </strong>{' '}
                    {item.activationEvidence}
                  </div>

                  {/* Mechanism */}
                  <div
                    style={{
                      fontSize: '11px',
                      lineHeight: '1.45',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--bg-secondary)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      borderLeft: `3px solid ${domain.color}`,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        marginBottom: '2px',
                        fontSize: '10px',
                      }}
                    >
                      Cognitive Mechanism:
                    </div>
                    {item.mechanism}
                  </div>

                  {/* Boundary */}
                  {item.boundary && (
                    <div
                      style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}
                    >
                      <span style={{ fontWeight: 600, color: '#e5e7eb' }}>Boundary: </span>
                      {item.boundary}
                    </div>
                  )}

                  {/* Downstream Effects */}
                  {item.downstreamEffects && (
                    <div
                      style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: '1.4' }}
                    >
                      <span style={{ fontWeight: 600, color: '#e5e7eb' }}>Effects: </span>
                      {item.downstreamEffects}
                    </div>
                  )}

                  {/* Test Activation Button */}
                  <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
                    <button
                      type="button"
                      disabled={isActivating}
                      onClick={() => void handleActivateState(item.id)}
                      style={{
                        width: '100%',
                        padding: '6px 12px',
                        fontSize: '11px',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: isActive
                          ? 'rgba(52, 211, 153, 0.15)'
                          : 'var(--bg-secondary)',
                        color: isActive ? '#34d399' : 'var(--text-primary)',
                        cursor: isActivating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive && !isActivating) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive && !isActivating) {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                        }
                      }}
                    >
                      <Sparkles size={12} color={isActive ? '#34d399' : domain.color} />
                      <span>
                        {isActivating
                          ? 'Activating...'
                          : isActive
                            ? 'Re-stimulate Active Episode'
                            : 'Trigger State Instance'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
