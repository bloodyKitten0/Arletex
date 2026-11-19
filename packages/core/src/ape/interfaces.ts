import {
  ActiveEmotionState,
  ActiveEmotionStatus,
  ApeAppraisal,
  ApeDevelopmentState,
  ApeEvent,
  ApeMotivationalState,
  ApePersonalProject,
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
  IntellectualQuestion,
  MoodTaxonomyItem,
  NarrativeEpoch,
  PersonalMilestone,
  PersonalMilestoneCategory,
  MilestoneStatus,
  NarrativeInterpretation,
  NarrativeIdentityState,
  FutureIntention,
  FutureIntentionStatus,
  UnfinishedCommitment,
  CommitmentStatus,
  LongTermPlan,
  LongTermPlanStatus,
  DurationProfile,
  WorldEntity,
  WorldEntityType,
  WorldRelation,
  WorldRelationType,
  WorldEnvironmentalChange,
  CausalRelationship,
  EpistemicUnknown,
  UnknownStatus,
  DetectedObject,
  PerceptualEvent,
  PerceptionModality,
  UnifiedMultimodalFrame,
  InteroceptiveSnapshot,
  OperationalMode,
  ComputationalResourceMetrics,
  ResourceRegulationDirective,
  SensorimotorActionRecord,
  InteractionStrategy,
  SpatialCalibration,
  OperationalActivity,
  ActivityStatus,
  EnvironmentalEvent,
  EventLayer,
  SituationalContextSnapshot,
  AttentionalFocusState,
  AttentionSwitchEvent,
  AttentionalStimulus,
  SalienceBreakdown,
  WorkingMemoryBuffer,
  WorkingMemorySnapshot,
  MultiSystemMemoryEntry,
  MemoryContradiction,
  MultiSystemQueryOptions,
  LearningExperience,
  BehavioralAdaptationRule,
  LearningExperienceFilter,
  ReasoningTask,
  ReasoningParadigm,
  CausalGraphModel,
  CausalIntervention,
  CognitivePrediction,
  PredictionStatus,
  PredictionType,
  SimulationScenario,
  SimulationScenarioType,
  AlternativeDecisionEvaluation,
  CognitiveAssessment,
  MetacognitiveCorrection,
  MetacognitiveContradictionItem,
  GlobalCognitiveCycleEvent,
  GlobalCognitiveSnapshot,
  ActionInhibitionEvaluation,
  TaskSwitchRecord,
  WorkingMemoryGatingDirective,
  ExecutiveControlState,
  SelfGeneratedGoal,
  SelfGeneratedGoalStatus,
  GoalOriginType,
  MultiStagePlan,
  MultiStagePlanStatus,
  LongTermCommitment,
  LongTermCommitmentStatus,
  InternalConflictRecord,
  InternalConflictStatus,
  AutonomousActivityRecord,
  AutonomousActivityStatus,
  AutonomousActivityType,
  AppraisalInterpretationComparison,
  EmotionalRepertoireState,
  EmotionalTransitionRecord,
  MixedEmotionalBlend,
  IndividualEmotionalTendencies,
  SetbackIncident,
  RegulationAttempt,
  EmotionalStabilityMetrics,
  HomeostaticNeedDefinition,
  HomeostaticNeedCategory,
  DriveState,
  HomeostaticActionResolution,
  MotivatedActivity,
  MotivationOrientation,
  InternalizationRecord,
  MotivationReassessmentResult,
  NoveltyDetectionRecord,
  KnowledgeGapRecord,
  ExploratoryQuestion,
  IndependentInvestigationRecord,
  DiscoveredInterest,
  RewardPrediction,
  OutcomeEvaluation,
  StrategyPerformanceRecord,
  DiminishingReturnAlert,
  HabitRecord,
  HabitExecutionLog,
  NoveltyRoutineBalance,
  TemperamentProfile,
  SituationalPersonalityExpression,
  PersonalityEvolutionRecord,
  MoralPrinciple,
  MoralPrincipleCategory,
  EthicalDilemmaResolution,
  MoralLearningRecord,
  DomainCompetence,
  EfficacyEvidence,
  CapabilityLimitation,
  SelfImprovementGoal,
  SelfEvaluationSnapshot,
  PsychologicalDimension,
  DevelopmentHistoryEntry,
  IdentityAnchor,
  DevelopmentEpoch,
  AgentMentalModel,
  InferredBelief,
  InferredIntention,
  SocialPrediction,
  InferredExperience,
  PerspectiveTakingModel,
  EmpatheticResponse,
  PerspectiveRevisionRecord,
  SocialEmotionState,
  SocialEmotionType,
  SocialInteractionAppraisal,
  ConversationalContext,
  PragmaticAnalysis,
  TurnTakingState,
  AudienceAdaptationProfile,
  AttachmentBond,
  SharedHistoryEvent,
  RelationalConflict,
  ApologyAndRepair,
  ConflictStatus,
  SocialNorm,
  ObservationalLearningRecord,
  GroupDynamicProfile,
  SocialActivityCoordination,
  PersonalVsSocialValueDilemma,
  ExpressiveVoiceProfile,
  ModelLinguisticAdaptation,
  ExpressiveUtteranceEvaluation,
  StorytellingFragment,
  CreativeIdea,
  IndependentCreativeProject,
  CreativeInterest,
  CreativeDomain,
  AestheticPreference,
  RecreationalActivity,
  IntellectualPlaySession,
  HumorDevelopmentRecord,
  AestheticCategory,
  OfflineActivityRecord,
  OfflineActivityType,
  ConsolidationRun,
  UnfinishedWorkItem,
  ProactiveNotificationProposal,
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

  // Personal Projects (Pillar 4)
  createPersonalProject(project: ApePersonalProject): ApePersonalProject;
  getPersonalProjectById(id: string): ApePersonalProject | null;
  listPersonalProjects(filter?: { status?: string; category?: string }): ApePersonalProject[];
  updatePersonalProject(project: Partial<ApePersonalProject> & { id: string }): ApePersonalProject;
  deletePersonalProject(id: string): boolean;

  // Intellectual Inquiry (Pillar 5)
  createIntellectualQuestion(q: IntellectualQuestion): IntellectualQuestion;
  getIntellectualQuestionById(id: string): IntellectualQuestion | null;
  listIntellectualQuestions(filter?: { status?: string; domain?: string }): IntellectualQuestion[];
  updateIntellectualQuestion(q: Partial<IntellectualQuestion> & { id: string }): IntellectualQuestion;
  deleteIntellectualQuestion(id: string): boolean;
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

export interface INarrativeRepository {
  getEpochById(id: string): NarrativeEpoch | null;
  getCurrentEpoch(): NarrativeEpoch | null;
  listEpochs(): NarrativeEpoch[];
  saveEpoch(epoch: NarrativeEpoch): void;

  getMilestoneById(id: string): PersonalMilestone | null;
  listMilestones(filter?: {
    epochId?: string;
    category?: PersonalMilestoneCategory;
    status?: MilestoneStatus;
  }): PersonalMilestone[];
  saveMilestone(milestone: PersonalMilestone): void;
  deleteMilestone(id: string): boolean;

  getInterpretationById(id: string): NarrativeInterpretation | null;
  getInterpretationForTarget(targetType: string, targetId: string): NarrativeInterpretation | null;
  listInterpretations(): NarrativeInterpretation[];
  saveInterpretation(interpretation: NarrativeInterpretation): void;

  getNarrativeState(): NarrativeIdentityState | null;
  saveNarrativeState(state: NarrativeIdentityState): void;
}

export interface ITemporalRepository {
  getIntentionById(id: string): FutureIntention | null;
  listIntentions(filter?: { status?: FutureIntentionStatus; limit?: number }): FutureIntention[];
  saveIntention(intention: FutureIntention): void;
  deleteIntention(id: string): boolean;

  getCommitmentById(id: string): UnfinishedCommitment | null;
  listCommitments(filter?: { status?: CommitmentStatus; partnerName?: string }): UnfinishedCommitment[];
  saveCommitment(commitment: UnfinishedCommitment): void;
  deleteCommitment(id: string): boolean;

  getPlanById(id: string): LongTermPlan | null;
  listPlans(filter?: { status?: LongTermPlanStatus }): LongTermPlan[];
  savePlan(plan: LongTermPlan): void;
  deletePlan(id: string): boolean;

  getDurationProfile(operationKey: string): DurationProfile | null;
  listDurationProfiles(): DurationProfile[];
  saveDurationProfile(profile: DurationProfile): void;
}

export interface IWorldRepository {
  getEntityById(id: string): WorldEntity | null;
  getEntityByName(name: string): WorldEntity | null;
  listEntities(filter?: { entityType?: WorldEntityType; category?: string; locationId?: string; limit?: number }): WorldEntity[];
  saveEntity(entity: WorldEntity): void;
  deleteEntity(id: string): boolean;

  getRelationById(id: string): WorldRelation | null;
  listRelations(filter?: { sourceEntityId?: string; targetEntityId?: string; relationType?: WorldRelationType }): WorldRelation[];
  saveRelation(relation: WorldRelation): void;
  deleteRelation(id: string): boolean;

  recordEnvironmentalChange(change: WorldEnvironmentalChange): void;
  listEnvironmentalChanges(filter?: { entityId?: string; limit?: number }): WorldEnvironmentalChange[];

  saveCausalRelationship(relationship: CausalRelationship): void;
  listCausalRelationships(filter?: { causeEntityId?: string; effectEntityId?: string }): CausalRelationship[];

  getUnknownById(id: string): EpistemicUnknown | null;
  listUnknowns(filter?: { status?: UnknownStatus; domain?: string }): EpistemicUnknown[];
  saveUnknown(unknown: EpistemicUnknown): void;
  deleteUnknown(id: string): boolean;
}

export interface IPerceptionRepository {
  saveFrame(frame: UnifiedMultimodalFrame): void;
  getFrameById(id: string): UnifiedMultimodalFrame | null;
  getLatestFrame(): UnifiedMultimodalFrame | null;
  listFrames(limit?: number): UnifiedMultimodalFrame[];

  recordPerceptualEvent(event: PerceptualEvent, frameId?: string): void;
  listPerceptualEvents(filter?: { eventType?: string; modality?: PerceptionModality; limit?: number }): PerceptualEvent[];

  recordDetectedObjects(objects: DetectedObject[], frameId?: string): void;
  listDetectedObjects(filter?: { label?: string; category?: string; limit?: number }): DetectedObject[];
}

export interface IEmbodimentRepository {
  saveSnapshot(snapshot: InteroceptiveSnapshot): void;
  getSnapshotById(id: string): InteroceptiveSnapshot | null;
  getLatestSnapshot(): InteroceptiveSnapshot | null;
  listSnapshots(limit?: number): InteroceptiveSnapshot[];

  recordConstraintEvent(event: {
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
  }): void;
  listConstraintEvents(limit?: number): Array<{
    id: string;
    timestamp: string;
    previousMode: OperationalMode;
    newMode: OperationalMode;
    triggerReason: string;
    resourceState: ComputationalResourceMetrics;
    directiveIssued: ResourceRegulationDirective;
    createdAt: string;
  }>;

  recordRegulationDirective(directive: ResourceRegulationDirective & { id?: string }): void;
  getLatestRegulationDirective(): ResourceRegulationDirective | null;
}

export interface ISensorimotorRepository {
  recordAction(record: SensorimotorActionRecord): void;
  getActionRecordById(id: string): SensorimotorActionRecord | null;
  listActionRecords(filter?: { sessionId?: string; actionType?: string; status?: string; limit?: number }): SensorimotorActionRecord[];

  saveStrategy(strategy: InteractionStrategy): void;
  getStrategy(targetAppOrContext: string, goalType: string): InteractionStrategy | null;
  listStrategies(targetAppOrContext?: string): InteractionStrategy[];

  saveSpatialCalibration(calibration: SpatialCalibration): void;
  getLatestSpatialCalibration(displayId?: string): SpatialCalibration | null;
}

export interface ISituationalRepository {
  saveActivity(activity: OperationalActivity): void;
  getActivityById(id: string): OperationalActivity | null;
  getActiveActivity(): OperationalActivity | null;
  listActivities(status?: ActivityStatus, limit?: number): OperationalActivity[];

  recordEnvironmentalEvent(event: EnvironmentalEvent): void;
  getEnvironmentalEventById(id: string): EnvironmentalEvent | null;
  listEnvironmentalEvents(filter?: { layer?: EventLayer; isInterruption?: boolean; minRelevance?: number; limit?: number }): EnvironmentalEvent[];

  saveSnapshot(snapshot: SituationalContextSnapshot): void;
  getSnapshotById(id: string): SituationalContextSnapshot | null;
  getLatestSnapshot(): SituationalContextSnapshot | null;
  listSnapshots(limit?: number): SituationalContextSnapshot[];
}

export interface IAttentionRepository {
  saveFocusState(state: AttentionalFocusState): void;
  getLatestFocusState(): AttentionalFocusState | null;
  listFocusStates(limit?: number): AttentionalFocusState[];

  recordSwitchEvent(event: AttentionSwitchEvent): void;
  listSwitchEvents(limit?: number): AttentionSwitchEvent[];

  recordStimulusEvaluation(stimulus: AttentionalStimulus, salience: SalienceBreakdown, wasAttended: boolean): void;
  listStimulusEvaluations(filter?: { wasAttended?: boolean; stimulusType?: string; limit?: number }): Array<{
    id: string;
    timestamp: string;
    stimulusType: string;
    source: string;
    summary: string;
    content?: any;
    salience: SalienceBreakdown;
    wasAttended: boolean;
  }>;
}

export interface IWorkingMemoryRepository {
  saveBuffer(buffer: WorkingMemoryBuffer): void;
  getBufferByTaskId(taskId: string): WorkingMemoryBuffer | null;
  getLatestBuffer(): WorkingMemoryBuffer | null;
  deleteBuffer(taskId: string): void;

  saveSnapshot(snapshot: WorkingMemorySnapshot): void;
  getLatestSnapshot(taskId?: string): WorkingMemorySnapshot | null;
  listSnapshots(taskId?: string, limit?: number): WorkingMemorySnapshot[];
}

export interface IMultiSystemMemoryRepository {
  createEntry(entry: MultiSystemMemoryEntry): void;
  getEntryById(id: string): MultiSystemMemoryEntry | null;
  updateEntry(entry: MultiSystemMemoryEntry): void;
  listEntries(options?: MultiSystemQueryOptions): MultiSystemMemoryEntry[];
  deleteEntry(id: string): void;

  recordContradiction(contradiction: MemoryContradiction): void;
  getContradictionById(id: string): MemoryContradiction | null;
  listContradictions(status?: MemoryContradiction['status']): MemoryContradiction[];
  updateContradiction(contradiction: MemoryContradiction): void;
}

export interface ILearningRepository {
  recordExperience(experience: LearningExperience): void;
  getExperienceById(id: string): LearningExperience | null;
  listExperiences(filter?: LearningExperienceFilter): LearningExperience[];

  saveRule(rule: BehavioralAdaptationRule): void;
  getRuleById(id: string): BehavioralAdaptationRule | null;
  listRules(filter?: { domain?: string; minConfidence?: number }): BehavioralAdaptationRule[];
  updateRule(rule: BehavioralAdaptationRule): void;
  deleteRule(id: string): void;
}

export interface IReasoningRepository {
  saveTask(task: ReasoningTask): void;
  getTaskById(id: string): ReasoningTask | null;
  listTasks(filter?: { domain?: string; paradigm?: ReasoningParadigm; limit?: number }): ReasoningTask[];
  deleteTask(id: string): void;
}

export interface ICausalRepository {
  saveGraph(graph: CausalGraphModel): void;
  getGraphById(id: string): CausalGraphModel | null;
  getGraphByDomain(domain: string): CausalGraphModel | null;
  listGraphs(): CausalGraphModel[];
  deleteGraph(id: string): void;

  recordIntervention(intervention: CausalIntervention): void;
  listInterventions(graphId?: string): CausalIntervention[];
}

export interface IPredictiveRepository {
  createPrediction(prediction: CognitivePrediction): void;
  getPredictionById(id: string): CognitivePrediction | null;
  updatePrediction(prediction: CognitivePrediction): void;
  listPredictions(filter?: {
    domain?: string;
    status?: PredictionStatus;
    predictionType?: PredictionType;
    limit?: number;
  }): CognitivePrediction[];
  deletePrediction(id: string): void;
}

export interface ISimulationRepository {
  saveScenario(scenario: SimulationScenario): void;
  getScenarioById(id: string): SimulationScenario | null;
  listScenarios(filter?: {
    type?: SimulationScenarioType;
    limit?: number;
  }): SimulationScenario[];
  deleteScenario(id: string): void;

  saveDecisionEvaluation(evaluation: AlternativeDecisionEvaluation): void;
  getDecisionEvaluationById(id: string): AlternativeDecisionEvaluation | null;
  listDecisionEvaluations(limit?: number): AlternativeDecisionEvaluation[];
  deleteDecisionEvaluation(id: string): void;
}

export interface IMetacognitionRepository {
  saveAssessment(assessment: CognitiveAssessment): void;
  getAssessmentById(id: string): CognitiveAssessment | null;
  listAssessments(filter?: { targetDomain?: string; limit?: number }): CognitiveAssessment[];
  deleteAssessment(id: string): void;

  saveCorrection(correction: MetacognitiveCorrection): void;
  getCorrectionById(id: string): MetacognitiveCorrection | null;
  listCorrections(filter?: { assessmentId?: string; limit?: number }): MetacognitiveCorrection[];

  saveContradiction(contradiction: MetacognitiveContradictionItem): void;
  getContradictionById(id: string): MetacognitiveContradictionItem | null;
  listContradictions(filter?: { status?: MetacognitiveContradictionItem['status']; limit?: number }): MetacognitiveContradictionItem[];
  updateContradictionStatus(id: string, status: MetacognitiveContradictionItem['status'], notes?: string): void;
}

export interface IGlobalCognitiveRepository {
  saveCycle(cycle: GlobalCognitiveCycleEvent): void;
  getCycleById(id: string): GlobalCognitiveCycleEvent | null;
  getCycleByTraceId(traceId: string): GlobalCognitiveCycleEvent | null;
  listCycles(limit?: number): GlobalCognitiveCycleEvent[];
  deleteCycle(id: string): void;

  saveSnapshot(snapshot: GlobalCognitiveSnapshot): void;
  getLatestSnapshot(): GlobalCognitiveSnapshot | null;
}

export interface IExecutiveRepository {
  saveInhibition(inhibition: ActionInhibitionEvaluation): void;
  getInhibitionById(id: string): ActionInhibitionEvaluation | null;
  listInhibitions(limit?: number): ActionInhibitionEvaluation[];

  saveTaskSwitch(record: TaskSwitchRecord): void;
  getTaskSwitchById(id: string): TaskSwitchRecord | null;
  listTaskSwitches(limit?: number): TaskSwitchRecord[];

  saveMemoryGating(gating: WorkingMemoryGatingDirective): void;
  listMemoryGatings(targetBufferId?: string, limit?: number): WorkingMemoryGatingDirective[];

  saveControlState(state: ExecutiveControlState): void;
  getControlState(): ExecutiveControlState | null;
}

export interface ISelfGeneratedGoalRepository {
  saveGoal(goal: SelfGeneratedGoal): void;
  getGoalById(id: string): SelfGeneratedGoal | null;
  listGoals(filter?: { status?: SelfGeneratedGoalStatus; origin?: GoalOriginType; limit?: number }): SelfGeneratedGoal[];
  deleteGoal(id: string): void;
  recordTrigger(trigger: { id: string; triggerType: string; sourceEntityId?: string; generatedGoalId: string; rationale: string; createdAt: string }): void;
  listTriggers(generatedGoalId?: string): Array<{ id: string; triggerType: string; sourceEntityId?: string; generatedGoalId: string; rationale: string; createdAt: string }>;
}

export interface IPersistentPlanningRepository {
  savePlan(plan: MultiStagePlan): void;
  getPlanById(id: string): MultiStagePlan | null;
  getPlanByGoalId(goalId: string): MultiStagePlan | null;
  listPlans(filter?: { status?: MultiStagePlanStatus; limit?: number }): MultiStagePlan[];
  deletePlan(id: string): void;

  saveCommitment(commitment: LongTermCommitment): void;
  getCommitmentById(id: string): LongTermCommitment | null;
  listCommitments(filter?: { stakeholder?: string; status?: LongTermCommitmentStatus; limit?: number }): LongTermCommitment[];
  deleteCommitment(id: string): void;
}

export interface IDeliberationRepository {
  saveConflict(conflict: InternalConflictRecord): void;
  getConflictById(id: string): InternalConflictRecord | null;
  listConflicts(filter?: { status?: InternalConflictStatus; limit?: number }): InternalConflictRecord[];
  deleteConflict(id: string): void;
}

export interface IAutonomousActivityRepository {
  saveActivity(activity: AutonomousActivityRecord): void;
  getActivityById(id: string): AutonomousActivityRecord | null;
  listActivities(filter?: {
    status?: AutonomousActivityStatus;
    type?: AutonomousActivityType;
    goalId?: string;
    limit?: number;
  }): AutonomousActivityRecord[];
  deleteActivity(id: string): void;
}

export interface IEmotionalAppraisalRepository {
  saveComparison(comparison: AppraisalInterpretationComparison): void;
  getComparisonById(id: string): AppraisalInterpretationComparison | null;
  listComparisons(limit?: number): AppraisalInterpretationComparison[];
  deleteComparison(id: string): void;
}

export interface IEmotionalRepertoireRepository {
  saveActiveState(state: EmotionalRepertoireState): void;
  getActiveState(): EmotionalRepertoireState | null;
  recordTransition(record: EmotionalTransitionRecord): void;
  getTransitions(limit?: number): EmotionalTransitionRecord[];
  recordBlend(blend: MixedEmotionalBlend): void;
  getBlendHistory(limit?: number): MixedEmotionalBlend[];
  getIndividualTendencies(): IndividualEmotionalTendencies;
  saveIndividualTendencies(tendencies: IndividualEmotionalTendencies): void;
}

export interface IEmotionalRegulationRepository {
  saveSetback(setback: SetbackIncident): void;
  getSetbackById(id: string): SetbackIncident | null;
  listSetbacks(limit?: number): SetbackIncident[];
  saveRegulationAttempt(attempt: RegulationAttempt): void;
  getRegulationAttempts(setbackId?: string, limit?: number): RegulationAttempt[];
  getStabilityMetrics(): EmotionalStabilityMetrics;
  saveStabilityMetrics(metrics: EmotionalStabilityMetrics): void;
}

export interface IHomeostasisRepository {
  saveNeed(need: HomeostaticNeedDefinition): void;
  getNeedByCategory(category: HomeostaticNeedCategory): HomeostaticNeedDefinition | null;
  listNeeds(): HomeostaticNeedDefinition[];
  saveDrive(drive: DriveState): void;
  getActiveDrives(limit?: number): DriveState[];
  recordResolution(resolution: HomeostaticActionResolution): void;
  listResolutions(limit?: number): HomeostaticActionResolution[];
}

export interface IIntrinsicMotivationRepository {
  saveActivity(activity: MotivatedActivity): void;
  getActivityById(id: string): MotivatedActivity | null;
  listActivities(filter?: {
    orientation?: MotivationOrientation;
    status?: string;
    limit?: number;
  }): MotivatedActivity[];
  saveInternalization(record: InternalizationRecord): void;
  getInternalizations(activityId?: string, limit?: number): InternalizationRecord[];
  saveReassessment(record: MotivationReassessmentResult): void;
  getReassessments(activityId?: string, limit?: number): MotivationReassessmentResult[];
}

export interface ICuriosityExplorationRepository {
  saveNovelty(record: NoveltyDetectionRecord): void;
  listNoveltyDetections(limit?: number): NoveltyDetectionRecord[];
  saveKnowledgeGap(gap: KnowledgeGapRecord): void;
  listKnowledgeGaps(domain?: string, limit?: number): KnowledgeGapRecord[];
  saveQuestion(question: ExploratoryQuestion): void;
  listQuestions(knowledgeGapId?: string, limit?: number): ExploratoryQuestion[];
  saveInvestigation(investigation: IndependentInvestigationRecord): void;
  listInvestigations(domain?: string, limit?: number): IndependentInvestigationRecord[];
  saveInterest(interest: DiscoveredInterest): void;
  getInterestById(id: string): DiscoveredInterest | null;
  listInterests(limit?: number): DiscoveredInterest[];
}

export interface IRewardLearningRepository {
  savePrediction(prediction: RewardPrediction): void;
  getPredictionById(id: string): RewardPrediction | null;
  listPredictions(strategyId?: string, limit?: number): RewardPrediction[];
  saveOutcomeEvaluation(evaluation: OutcomeEvaluation): void;
  getOutcomeEvaluationById(id: string): OutcomeEvaluation | null;
  listOutcomeEvaluations(strategyId?: string, domain?: string, limit?: number): OutcomeEvaluation[];
  saveStrategyPerformance(strategy: StrategyPerformanceRecord): void;
  getStrategyPerformance(strategyId: string): StrategyPerformanceRecord | null;
  listStrategyPerformances(domain?: string, limit?: number): StrategyPerformanceRecord[];
  saveDiminishingAlert(alert: DiminishingReturnAlert): void;
  listDiminishingAlerts(strategyId?: string, limit?: number): DiminishingReturnAlert[];
}

export interface IHabitsAndRoutinesRepository {
  saveHabit(habit: HabitRecord): void;
  getHabitById(id: string): HabitRecord | null;
  listHabits(domain?: string, activeOnly?: boolean, limit?: number): HabitRecord[];
  saveExecutionLog(log: HabitExecutionLog): void;
  listExecutionLogs(habitId?: string, limit?: number): HabitExecutionLog[];
  saveBalance(balance: NoveltyRoutineBalance): void;
  getLatestBalance(): NoveltyRoutineBalance | null;
}

export interface ITemperamentPersonalityRepository {
  saveProfile(profile: TemperamentProfile): void;
  getProfile(id?: string): TemperamentProfile | null;
  saveSituationalExpression(expression: SituationalPersonalityExpression): void;
  listSituationalExpressions(situationType?: string, limit?: number): SituationalPersonalityExpression[];
  saveEvolutionRecord(record: PersonalityEvolutionRecord): void;
  listEvolutionRecords(traitKey?: string, limit?: number): PersonalityEvolutionRecord[];
}

export interface IValuesMoralRepository {
  savePrinciple(principle: MoralPrinciple): void;
  getPrincipleById(id: string): MoralPrinciple | null;
  listPrinciples(category?: MoralPrincipleCategory, limit?: number): MoralPrinciple[];
  saveResolution(resolution: EthicalDilemmaResolution): void;
  getResolutionById(id: string): EthicalDilemmaResolution | null;
  listResolutions(limit?: number): EthicalDilemmaResolution[];
  saveMoralLearning(record: MoralLearningRecord): void;
  listMoralLearningRecords(principleId?: string, limit?: number): MoralLearningRecord[];
}

export interface ISelfEvaluationEfficacyRepository {
  saveDomainCompetence(competence: DomainCompetence): void;
  getDomainCompetence(domain: string): DomainCompetence | null;
  listDomainCompetences(): DomainCompetence[];
  saveEvidence(evidence: EfficacyEvidence): void;
  listEvidence(domain?: string, type?: 'achievement' | 'failure', limit?: number): EfficacyEvidence[];
  saveLimitation(limitation: CapabilityLimitation): void;
  listLimitations(domain?: string): CapabilityLimitation[];
  saveImprovementGoal(goal: SelfImprovementGoal): void;
  getImprovementGoalById(id: string): SelfImprovementGoal | null;
  listImprovementGoals(domain?: string, status?: string): SelfImprovementGoal[];
  saveSnapshot(snapshot: SelfEvaluationSnapshot): void;
  getLatestSnapshot(): SelfEvaluationSnapshot | null;
}

export interface ILongTermDevelopmentRepository {
  saveHistoryEntry(entry: DevelopmentHistoryEntry): void;
  listHistoryEntries(dimension?: PsychologicalDimension, limit?: number): DevelopmentHistoryEntry[];
  countHistoryEntries(): number;
  saveIdentityAnchor(anchor: IdentityAnchor): void;
  getIdentityAnchor(anchorKey: string): IdentityAnchor | null;
  listIdentityAnchors(): IdentityAnchor[];
  saveEpoch(epoch: DevelopmentEpoch): void;
  getCurrentEpoch(): DevelopmentEpoch | null;
  listEpochs(): DevelopmentEpoch[];
}

export interface ITheoryOfMindRepository {
  saveAgentModel(model: AgentMentalModel): void;
  getAgentModel(agentId: string): AgentMentalModel | null;
  listAgentModels(): AgentMentalModel[];
  saveBelief(belief: InferredBelief): void;
  getBelief(agentId: string, topic: string): InferredBelief | null;
  listBeliefs(agentId?: string): InferredBelief[];
  saveIntention(intention: InferredIntention): void;
  listIntentions(agentId?: string, limit?: number): InferredIntention[];
  saveSocialPrediction(prediction: SocialPrediction): void;
  listSocialPredictions(agentId?: string, limit?: number): SocialPrediction[];
}

export interface IEmpathyPerspectiveRepository {
  saveExperience(experience: InferredExperience): void;
  getExperienceById(id: string): InferredExperience | null;
  listExperiences(targetPersonId?: string, limit?: number): InferredExperience[];
  savePerspectiveModel(model: PerspectiveTakingModel): void;
  getPerspectiveModel(targetPersonId: string): PerspectiveTakingModel | null;
  listPerspectiveModels(): PerspectiveTakingModel[];
  saveResponse(response: EmpatheticResponse): void;
  listResponses(targetPersonId?: string, limit?: number): EmpatheticResponse[];
  saveRevision(revision: PerspectiveRevisionRecord): void;
  listRevisions(perspectiveId?: string, limit?: number): PerspectiveRevisionRecord[];
}

export interface ISocialEmotionsRepository {
  saveEmotionState(state: SocialEmotionState): void;
  getEmotionState(targetPersonId: string, emotion: SocialEmotionType): SocialEmotionState | null;
  listEmotionStates(targetPersonId?: string): SocialEmotionState[];
  saveAppraisal(appraisal: SocialInteractionAppraisal): void;
  listAppraisals(targetPersonId?: string, limit?: number): SocialInteractionAppraisal[];
}

export interface ISocialCommunicationRepository {
  saveContext(context: ConversationalContext): void;
  getContextBySession(sessionId: string): ConversationalContext | null;
  savePragmaticAnalysis(analysis: PragmaticAnalysis): void;
  listPragmaticAnalyses(speakerId?: string, limit?: number): PragmaticAnalysis[];
  recordTurnTakingEvent(event: TurnTakingState & { sessionId: string; timestamp: string }): void;
  getLatestTurnTakingEvent(sessionId: string): (TurnTakingState & { sessionId: string; timestamp: string }) | null;
  saveAdaptationProfile(profile: AudienceAdaptationProfile & { updatedAt: string }): void;
  getAdaptationProfile(targetAudienceId: string): (AudienceAdaptationProfile & { updatedAt: string }) | null;
}

export interface IRelationshipsAttachmentRepository {
  saveBond(bond: AttachmentBond): void;
  getBond(personId: string): AttachmentBond | null;
  listBonds(): AttachmentBond[];
  saveSharedEvent(event: SharedHistoryEvent): void;
  listSharedEvents(personId: string, limit?: number): SharedHistoryEvent[];
  saveConflict(conflict: RelationalConflict): void;
  getConflict(id: string): RelationalConflict | null;
  listConflicts(personId?: string, status?: ConflictStatus): RelationalConflict[];
  saveApologyRepair(repair: ApologyAndRepair): void;
  listApologyRepairs(conflictId: string): ApologyAndRepair[];
}

export interface ISocialLearningCultureRepository {
  saveSocialNorm(norm: SocialNorm): void;
  getSocialNorm(id: string): SocialNorm | null;
  listSocialNorms(culturalContext?: string): SocialNorm[];
  saveObservationalRecord(record: ObservationalLearningRecord): void;
  listObservationalRecords(actorId?: string, limit?: number): ObservationalLearningRecord[];
  saveGroupProfile(profile: GroupDynamicProfile): void;
  getGroupProfile(groupId: string): GroupDynamicProfile | null;
  listGroupProfiles(): GroupDynamicProfile[];
  saveActivityCoordination(activity: SocialActivityCoordination): void;
  listActivityCoordinations(limit?: number): SocialActivityCoordination[];
  saveValueDilemma(dilemma: PersonalVsSocialValueDilemma): void;
  listValueDilemmas(limit?: number): PersonalVsSocialValueDilemma[];
}

export interface IExpressiveIdentityRepository {
  getVoiceProfile(): ExpressiveVoiceProfile | null;
  saveVoiceProfile(profile: ExpressiveVoiceProfile): void;
  getAdaptation(modelFamily: string): (ModelLinguisticAdaptation & { updatedAt: string }) | null;
  saveAdaptation(adaptation: ModelLinguisticAdaptation & { updatedAt: string }): void;
  saveUtteranceEvaluation(evaluation: ExpressiveUtteranceEvaluation): void;
  listUtteranceEvaluations(limit?: number): ExpressiveUtteranceEvaluation[];
  saveStoryFragment(fragment: StorytellingFragment): void;
  listStoryFragments(limit?: number): StorytellingFragment[];
}

export interface ICreativityRepository {
  saveIdea(idea: CreativeIdea): void;
  getIdea(id: string): CreativeIdea | null;
  listIdeas(domain?: CreativeDomain, status?: string): CreativeIdea[];
  saveProject(project: IndependentCreativeProject): void;
  getProject(id: string): IndependentCreativeProject | null;
  listProjects(domain?: CreativeDomain): IndependentCreativeProject[];
  saveInterest(interest: CreativeInterest): void;
  getInterest(id: string): CreativeInterest | null;
  listInterests(domain?: CreativeDomain): CreativeInterest[];
}

export interface IPlayHumourAestheticsRepository {
  savePreference(preference: AestheticPreference): void;
  getPreference(id: string): AestheticPreference | null;
  listPreferences(category?: AestheticCategory): AestheticPreference[];
  saveActivity(activity: RecreationalActivity): void;
  listActivities(category?: AestheticCategory, limit?: number): RecreationalActivity[];
  savePlaySession(session: IntellectualPlaySession): void;
  listPlaySessions(limit?: number): IntellectualPlaySession[];
  saveHumorRecord(record: HumorDevelopmentRecord): void;
  listHumorRecords(limit?: number): HumorDevelopmentRecord[];
}

export interface IOfflineCognitiveActivityRepository {
  saveActivity(activity: OfflineActivityRecord): void;
  getActivity(id: string): OfflineActivityRecord | null;
  listActivities(filter?: {
    activityType?: OfflineActivityType;
    status?: string;
    limit?: number;
  }): OfflineActivityRecord[];
  saveConsolidationRun(run: ConsolidationRun): void;
  listConsolidationRuns(limit?: number): ConsolidationRun[];
  saveUnfinishedWorkItem(item: UnfinishedWorkItem): void;
  listUnfinishedWorkItems(status?: string): UnfinishedWorkItem[];
  saveProactiveProposal(proposal: ProactiveNotificationProposal): void;
  listProactiveProposals(delivered?: boolean): ProactiveNotificationProposal[];
}


















