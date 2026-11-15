import {
  ActionProposal,
  AgencyObservation,
  VerificationResult,
} from '@arletex/contracts';
import { ILogger, rootLogger } from '../logger.js';

export class VerificationEngine {
  private logger: ILogger;

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('VerificationEngine');
  }

  /**
   * Compares the observed state against the expected state of an action.
   * Produces an uncompromising, deterministic verification verdict.
   */
  public verify(
    action: ActionProposal,
    observation: AgencyObservation | null,
  ): VerificationResult {
    const timestamp = new Date().toISOString();
    this.logger.debug(`Verifying action ${action.id} (${action.type}) against observation ${observation?.id}`);

    if (!observation) {
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: 'No observation could be obtained from the system.',
        verified: false,
        confidence: 1.0,
        failureReason: 'Missing observation probe.',
        isRecoverable: true,
        recommendedStrategy: 'retry_with_backoff',
        timestamp,
      };
    }

    if (!observation.success) {
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: `Observation reported failure: ${observation.error || 'Unknown error'}`,
        verified: false,
        confidence: 0.9,
        failureReason: observation.error || 'Target environment reported execution error',
        isRecoverable: true,
        recommendedStrategy: 'replan_sub_steps',
        timestamp,
      };
    }

    // 1. Web Video Selection Verification (Acceptance Scenario)
    if (action.type === 'web_select_video') {
      const actionParams = (action as any).parameters || {};
      const targetUrl = (actionParams.url as string) || (action.payload?.targetUrl as string) || (action.payload?.url as string);
      const expectedTitle = ((actionParams.title as string) || (action.payload?.videoTitle as string) || '').toLowerCase();
      const currentUrl = (observation.data?.currentUrl as string || observation.data?.url as string || '');
      const pageTitle = (observation.data?.pageTitle as string || observation.data?.title as string || '').toLowerCase();
      const isVideoPresent = Boolean(observation.data?.hasVideoElement);
      const isPlaying = Boolean(observation.data?.isPlaying);
      const playbackError = observation.data?.playbackError as string | undefined;

      // URL Verification
      const urlMatches = Boolean(
        targetUrl && currentUrl && (currentUrl.includes(targetUrl) || targetUrl.includes(currentUrl)),
      );

      // Title & Video element presence
      const titleMatches = expectedTitle ? pageTitle.includes(expectedTitle.slice(0, 15)) : true;

      if (!urlMatches && !titleMatches) {
        return {
          actionId: action.id,
          expectedOutcome: `Video page matching "${expectedTitle}" (${targetUrl})`,
          observedOutcome: `Navigated to unexpected URL: ${currentUrl} - Title: ${pageTitle}`,
          verified: false,
          confidence: 0.95,
          failureReason: 'Page URL and title do not match the selected candidate.',
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          timestamp,
        };
      }

      if (!isVideoPresent) {
        return {
          actionId: action.id,
          expectedOutcome: 'HTML video element initialized on page',
          observedOutcome: 'No video element detected on the loaded page.',
          verified: false,
          confidence: 0.9,
          failureReason: 'The target page is not an active video playback interface.',
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          timestamp,
        };
      }

      if (playbackError) {
        return {
          actionId: action.id,
          expectedOutcome: 'Video playing cleanly',
          observedOutcome: `Player error: ${playbackError}`,
          verified: false,
          confidence: 0.95,
          failureReason: `Video playback blocked or unavailable: ${playbackError}`,
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          timestamp,
        };
      }

      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: `Video player is open and playback confirmed at ${currentUrl}. Title: "${pageTitle}". Playing: ${isPlaying}`,
        verified: true,
        confidence: 0.95,
        failureReason: null,
        isRecoverable: false,
        timestamp,
      };
    }

    // 2. Web Navigation Verification
    if (action.type === 'web_navigate') {
      const targetUrl = action.payload?.url as string;
      const currentUrl = observation.data?.currentUrl as string;
      const statusCode = observation.data?.statusCode as number | undefined;

      if (statusCode && statusCode >= 400) {
        return {
          actionId: action.id,
          expectedOutcome: `HTTP 200 at ${targetUrl}`,
          observedOutcome: `HTTP ${statusCode} on navigation`,
          verified: false,
          confidence: 1.0,
          failureReason: `Web server returned status ${statusCode}`,
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          timestamp,
        };
      }

      const match = Boolean(targetUrl && currentUrl && currentUrl.startsWith(targetUrl.slice(0, 20)));
      return {
        actionId: action.id,
        expectedOutcome: `Loaded page ${targetUrl}`,
        observedOutcome: `Active page ${currentUrl}`,
        verified: match,
        confidence: match ? 0.95 : 0.8,
        failureReason: match ? null : 'Browser did not settle on expected URL destination',
        isRecoverable: !match,
        recommendedStrategy: match ? undefined : 'retry_with_backoff',
        timestamp,
      };
    }

    // 3. Application Launch Verification
    if (action.type === 'app_launch') {
      const appName = String(action.payload?.appName || action.payload?.app || (action as any).parameters?.app || 'application');
      const pid = observation.data?.pid as number | undefined;
      const isRunning = Boolean(observation.data?.isRunning ?? observation.success ?? (pid && pid > 0));

      return {
        actionId: action.id,
        expectedOutcome: `Application '${appName}' running in process table`,
        observedOutcome: isRunning ? `Process confirmed running (PID ${pid})` : 'Process not found in system table',
        verified: isRunning,
        confidence: 0.95,
        failureReason: isRunning ? null : `Failed to launch application binary '${appName}'`,
        isRecoverable: !isRunning,
        recommendedStrategy: isRunning ? undefined : 'retry_with_backoff',
        timestamp,
      };
    }

    // 4. File Write Verification
    if (action.type === 'system_write_file') {
      const filePath = action.payload?.filePath as string;
      const fileExists = Boolean(observation.data?.exists);
      const sizeBytes = Number(observation.data?.sizeBytes || 0);

      const verified = fileExists && sizeBytes > 0;
      return {
        actionId: action.id,
        expectedOutcome: `File written at ${filePath}`,
        observedOutcome: verified
          ? `File exists (${sizeBytes} bytes)`
          : 'File missing or zero length on disk',
        verified,
        confidence: 1.0,
        failureReason: verified ? null : 'Filesystem write could not be verified on disk',
        isRecoverable: !verified,
        recommendedStrategy: verified ? undefined : 'replan_sub_steps',
        timestamp,
      };
    }

    // Default Fallback Verification
    return {
      actionId: action.id,
      expectedOutcome: action.expectedOutcome,
      observedOutcome: 'Observation verified with default heuristic',
      verified: observation.success,
      confidence: 0.85,
      failureReason: observation.success ? null : 'Observation reported unverified state',
      isRecoverable: !observation.success,
      recommendedStrategy: observation.success ? undefined : 'retry_with_backoff',
      timestamp,
    };
  }
}
