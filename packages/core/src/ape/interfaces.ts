import {
  ActiveEmotionState,
  ActiveEmotionStatus,
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
  ApeMotivationalState,
  ApePersonalityState,
  ApeProcessingStatus,
  ApePsychologicalState,
  ApeRelationshipConfig,
  ApeRelationshipState,
  ApeSelfModel,
  ApeTransitionRecord,
  ContextualAffectiveMeasurements,
  CorePadDimensions,
  EmotionTaxonomyItem,
  MoodTaxonomyItem,
} from '@arletex/contracts';

export interface IApeRepository {
  transaction<T>(fn: () => T): T;
  getEmotionTaxonomy(): EmotionTaxonomyItem[];
  getMoodTaxonomy(): MoodTaxonomyItem[];
  getAffectiveState(): ApePsychologicalState;
  updateAffectiveState(
    padOrPartial:
      | CorePadDimensions
      | {
          pad?: Partial<CorePadDimensions>;
          contextual?: Partial<ContextualAffectiveMeasurements>;
          currentMood?: string;
          moodConfidence?: number;
        },
    contextual?: ContextualAffectiveMeasurements,
    mood?: string,
    moodConfidence?: number,
  ): void;
  getActiveEmotions(status?: ActiveEmotionStatus): ActiveEmotionState[];
  getActiveEmotionById(id: string): ActiveEmotionState | null;
  saveActiveEmotion(emotion: ActiveEmotionState): void;
  resolveActiveEmotion(id: string, reason?: string): void;
  consolidateToHistorical?(id: string): void;
  deleteActiveEmotion(id: string): boolean;
  logEvent(event: ApeEvent): boolean;
  getEvent(id: string): ApeEvent | null;
  saveEventProcessingStatus(id: string, status: ApeProcessingStatus, error?: string): void;
  markEventProcessed(id: string): void;
  listRecentEvents(limit?: number): ApeEvent[];
  saveAppraisal(appraisal: ApeAppraisal): void;
  recordTransition(transition: ApeTransitionRecord): void;
  listTransitions(limit?: number): ApeTransitionRecord[];
  listAppraisals(limit?: number): ApeAppraisal[];
  getRelationshipConfig(): ApeRelationshipConfig;
  updateRelationshipConfig(config: Partial<ApeRelationshipConfig>): ApeRelationshipConfig;

  // Engines 2-6
  getPersonalityState(): ApePersonalityState;
  savePersonalityState(state: ApePersonalityState): void;
  getMotivationalState(): ApeMotivationalState;
  saveMotivationalState(state: ApeMotivationalState): void;
  getExtendedRelationshipState(): ApeRelationshipState;
  saveExtendedRelationshipState(state: ApeRelationshipState): void;
  getSelfModel(): ApeSelfModel;
  saveSelfModel(state: ApeSelfModel): void;
  getDevelopmentState(): ApeDevelopmentState;
  saveDevelopmentState(state: ApeDevelopmentState): void;
}

export interface IApeInferenceGateway {
  streamChat(options: {
    conversationId: string;
    requestId: string;
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: any }>;
    signal?: AbortSignal;
    onChunk?: (chunk: any) => void;
  }): Promise<string>;
}
