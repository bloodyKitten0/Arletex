import {
  AgencyObservation,
  AgencyPlan,
  AgencyTask,
  VerificationResult,
} from '@arletex/contracts';

export interface PageObservation {
  url: string;
  title: string;
  hasVideoElement: boolean;
  isPlaying: boolean;
  videoDuration?: number;
  videoCurrentTime?: number;
  textSnippet: string;
  headings: string[];
  links: Array<{ text: string; href: string }>;
  statusCode?: number;
  playbackError?: string;
}

export interface VideoCandidate {
  title: string;
  url: string;
  uploader?: string;
  durationText?: string;
  durationSeconds?: number;
  views?: string;
  descriptionSnippet?: string;
  isEducational?: boolean;
}

export interface VideoSelectionDecision {
  selectedCandidate: VideoCandidate;
  candidatesEvaluated: number;
  rationale: string;
  rejectionReasons: Record<string, string>;
  confidence: number;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  metadata?: Record<string, any>;
}

export interface IBrowserProvider {
  navigate(url: string, timeoutMs?: number): Promise<PageObservation>;
  search(query: string, maxResults?: number): Promise<SearchResultItem[]>;
  searchVideos(query: string, maxResults?: number): Promise<VideoCandidate[]>;
  getPageDetails(): Promise<PageObservation>;
  click(selector: string): Promise<void>;
  typeText(selector: string, text: string): Promise<void>;
  close(): Promise<void>;
}

export interface IComputerProvider {
  launchApp(appName: string, args: string[]): Promise<{ pid: number; isRunning: boolean }>;
  getActiveWindow(): Promise<{ title: string; appName: string; windowId?: string }>;
  focusWindow(titleOrApp: string): Promise<boolean>;
  captureScreen(): Promise<{ imageBase64: string; width: number; height: number }>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, content: string, overwrite?: boolean): Promise<{ success: boolean; sizeBytes: number }>;
  listFiles(dirPath: string): Promise<string[]>;
  executeCommand?(command: string, args: string[]): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface IAgencyRepository {
  createTask(task: AgencyTask): AgencyTask;
  getTask(id: string): AgencyTask | null;
  updateTask(id: string, updates: Partial<AgencyTask>): AgencyTask;
  listTasks(status?: string, limit?: number): AgencyTask[];
  savePlan(plan: AgencyPlan): AgencyPlan;
  getPlanByTask(taskId: string): AgencyPlan | null;
  saveObservation(obs: AgencyObservation): AgencyObservation;
  getObservation(id: string): AgencyObservation | null;
  saveVerification(ver: VerificationResult): VerificationResult;
}
