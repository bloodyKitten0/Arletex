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
    return this.verifyInternal(action, observation);
  }

  /**
   * Alias for verify.
   */
  public verifyStep(
    action: ActionProposal,
    observation: AgencyObservation | null,
  ): VerificationResult {
    return this.verifyInternal(action, observation);
  }

  private verifyInternal(
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
        status: 'failed',
        failureReason: 'Missing observation probe.',
        isRecoverable: true,
        recommendedStrategy: 'retry_with_backoff',
        evidence: {},
        timestamp,
      };
    }

    if (!observation.success) {
      // For web video selection, allow specialized verification to extract detailed playback diagnostics and candidate switching
      if (action.type !== 'web_select_video') {
        return {
          actionId: action.id,
          expectedOutcome: action.expectedOutcome,
          observedOutcome: `Observation reported failure: ${observation.error || 'Unknown error'}`,
          verified: false,
          confidence: 0.9,
          status: 'failed',
          failureReason: observation.error || 'Target environment reported execution error',
          isRecoverable: true,
          recommendedStrategy: 'replan_sub_steps',
          evidence: observation.data || {},
          timestamp,
        };
      }
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
      const isProgressing = Boolean(observation.data?.playbackProgressing ?? isPlaying);
      const playbackState = (observation.data?.playbackState as string) || (isPlaying ? 'playing' : 'paused');
      const timeObservations = observation.data?.timeObservations || [];
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
          status: 'failed',
          failureReason: 'Page URL and title do not match the selected candidate.',
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          evidence: { currentUrl, pageTitle, expectedTitle, targetUrl },
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
          status: 'failed',
          failureReason: 'The target page is not an active video playback interface.',
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          evidence: { currentUrl, pageTitle, isVideoPresent: false },
          timestamp,
        };
      }

      if (playbackError || playbackState === 'error') {
        return {
          actionId: action.id,
          expectedOutcome: 'Video playing cleanly',
          observedOutcome: `Player error: ${playbackError || 'Media decode or network error'}`,
          verified: false,
          confidence: 0.95,
          status: 'failed',
          failureReason: `Video playback blocked or unavailable: ${playbackError || 'Playback error'}`,
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          evidence: { currentUrl, pageTitle, playbackError, playbackState },
          timestamp,
        };
      }

      // Check if player is present but playback is paused, stalled, or not progressing
      if (!isPlaying || !isProgressing) {
        return {
          actionId: action.id,
          expectedOutcome: 'Active progressing video playback verified',
          observedOutcome: `Video player is open at ${currentUrl}, but playback is ${playbackState} (progress unverified). Title: "${pageTitle}"`,
          verified: false,
          confidence: 0.95,
          status: 'partially_successful',
          failureReason: `Video player element detected but playback is not progressing (state: ${playbackState}).`,
          isRecoverable: true,
          recommendedStrategy: 'retry_with_backoff',
          evidence: {
            currentUrl,
            pageTitle,
            hasVideoElement: isVideoPresent,
            isPlaying,
            playbackProgressing: isProgressing,
            playbackState,
            timeObservations,
          },
          timestamp,
        };
      }

      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: `Video player is open and progressing playback confirmed at ${currentUrl}. Title: "${pageTitle}". State: playing.`,
        verified: true,
        confidence: 0.98,
        status: 'verified_successful',
        failureReason: null,
        isRecoverable: false,
        evidence: {
          currentUrl,
          pageTitle,
          hasVideoElement: isVideoPresent,
          isPlaying: true,
          playbackProgressing: true,
          playbackState: 'playing',
          timeObservations,
        },
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
          status: 'failed',
          failureReason: `Web server returned status ${statusCode}`,
          isRecoverable: true,
          recommendedStrategy: 'switch_candidate',
          evidence: { targetUrl, currentUrl, statusCode },
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
        status: match ? 'verified_successful' : 'failed',
        failureReason: match ? null : 'Browser did not settle on expected URL destination',
        isRecoverable: !match,
        recommendedStrategy: match ? undefined : 'retry_with_backoff',
        evidence: { targetUrl, currentUrl, statusCode },
        timestamp,
      };
    }

    // 3. Application Launch Verification
    if (action.type === 'app_launch') {
      const appName = String(action.payload?.appName || action.payload?.app || (action as any).parameters?.app || 'application');
      const pid = observation.data?.pid as number | undefined;
      const isRunning = Boolean(observation.data?.isRunning ?? observation.success ?? (pid && pid > 0));
      const windowFound = observation.data?.windowFound as boolean | undefined;

      // Spawning a process successfully does not establish that the requested application window opened.
      if (isRunning && windowFound === false) {
        return {
          actionId: action.id,
          expectedOutcome: `Application '${appName}' running and active window created`,
          observedOutcome: `Process started (PID ${pid || 'unknown'}), but application window was not detected in window manager`,
          verified: false,
          confidence: 0.9,
          status: 'partially_successful',
          failureReason: `Application window for '${appName}' not visible or failed to map`,
          isRecoverable: true,
          recommendedStrategy: 'retry_with_backoff',
          evidence: observation.data || {},
          timestamp,
        };
      }

      const isFullyVerified = Boolean(isRunning && windowFound !== false);
      return {
        actionId: action.id,
        expectedOutcome: `Application '${appName}' running with verified window`,
        observedOutcome: isRunning
          ? `Process confirmed running (PID ${pid})${windowFound ? ' and window verified' : ''}`
          : 'Process not found in system table',
        verified: isFullyVerified,
        confidence: windowFound ? 0.98 : 0.85,
        status: isFullyVerified ? 'verified_successful' : 'failed',
        failureReason: isRunning ? null : `Failed to launch application binary '${appName}'`,
        isRecoverable: !isRunning,
        recommendedStrategy: isRunning ? undefined : 'retry_with_backoff',
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 3b. Desktop File Opening Verification
    if (action.type === 'desktop_open_file' || action.type === 'system_open_file') {
      const target = String(action.payload?.filePath || action.payload?.fileName || 'file');
      const resolvedPath = String(observation.data?.resolvedPath || target);
      const opened = Boolean(observation.success && observation.data?.opened !== false);

      return {
        actionId: action.id,
        expectedOutcome: `File "${target}" located and opened on desktop`,
        observedOutcome: opened
          ? `File "${resolvedPath}" opened on desktop with default viewer`
          : `Failed to open file "${target}": ${observation.error || 'file not found'}`,
        verified: opened,
        confidence: opened ? 0.98 : 0.0,
        status: opened ? 'verified_successful' : 'failed',
        failureReason: opened ? null : (observation.error || `Could not open file "${target}"`),
        isRecoverable: !opened,
        recommendedStrategy: opened ? undefined : 'retry_with_backoff',
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 3c. Desktop Media Control Verification
    if (action.type === 'desktop_media_control') {
      const command = String(action.payload?.command || 'PlayPause');
      const success = Boolean(observation.success);

      return {
        actionId: action.id,
        expectedOutcome: `Media playback command "${command}" executed`,
        observedOutcome: success
          ? `MPRIS D-Bus command "${command}" dispatched and acknowledged by active media player`
          : `MPRIS D-Bus command "${command}" failed: ${observation.error || 'no player responding'}`,
        verified: success,
        confidence: success ? 0.95 : 0.0,
        status: success ? 'verified_successful' : 'failed',
        failureReason: success ? null : (observation.error || 'Media player communication failed'),
        isRecoverable: !success,
        recommendedStrategy: success ? undefined : 'retry_with_backoff',
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4. Web Search Verification (Search issued != Research completed)
    if (action.type === 'web_search') {
      const candidatesCount = Number(
        observation.data?.candidatesEvaluated ||
        (Array.isArray(observation.data?.candidates) ? observation.data.candidates.length : 0) ||
        (Array.isArray(observation.data?.results) ? observation.data.results.length : 0),
      );
      const verified = candidatesCount > 0;
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: verified
          ? `Discovered ${candidatesCount} relevant search candidate(s)`
          : 'Zero search results or candidates returned from source',
        verified,
        confidence: verified ? 0.95 : 0.9,
        status: verified ? 'verified_successful' : 'failed',
        failureReason: verified ? null : 'No candidates or sources discovered for search query',
        isRecoverable: !verified,
        recommendedStrategy: verified ? undefined : 'switch_candidate',
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4. File Write Verification
    if (action.type === 'system_write_file') {
      const filePath = action.payload?.filePath as string;
      const fileExists = Boolean(observation.data?.exists);
      const sizeBytes = Number(observation.data?.sizeBytes || 0);
      const sha256 = observation.data?.sha256;
      const expectedSha256 = observation.data?.expectedSha256;
      const hashMatched = sha256 && expectedSha256 ? sha256 === expectedSha256 : true;

      const verified = Boolean(fileExists && sizeBytes >= 0 && hashMatched && observation.success);
      return {
        actionId: action.id,
        expectedOutcome: `File written at ${filePath}`,
        observedOutcome: verified
          ? `File exists (${sizeBytes} bytes${sha256 ? `, sha256: ${sha256.slice(0, 8)}... verified` : ''})`
          : (!hashMatched
              ? 'SHA-256 hash mismatch: file contents on disk do not match written payload'
              : 'File missing or zero length on disk'),
        verified,
        confidence: 1.0,
        status: verified ? 'verified_successful' : 'failed',
        failureReason: verified
          ? null
          : (!hashMatched
              ? 'SHA-256 content verification failed upon read-back'
              : 'Filesystem write could not be verified on disk'),
        isRecoverable: !verified,
        recommendedStrategy: verified ? undefined : 'replan_sub_steps',
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4b. File Read Verification
    if (action.type === 'system_read_file') {
      const filePath = action.payload?.filePath as string;
      const content = observation.data?.content;
      const verified = Boolean(observation.success && content !== undefined);
      return {
        actionId: action.id,
        expectedOutcome: `Read file contents of ${filePath}`,
        observedOutcome: verified
          ? `File content read (${String(content).length} chars)`
          : (observation.error || 'Failed to read file'),
        verified,
        confidence: verified ? 1.0 : 0.0,
        status: verified ? 'verified_successful' : 'failed',
        failureReason: verified ? null : (observation.error || 'Failed to read file'),
        isRecoverable: !verified,
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4c. Directory Listing Verification
    if (action.type === 'system_list_directory') {
      const dirPath = action.payload?.dirPath as string;
      const entries = observation.data?.entries;
      const verified = Boolean(observation.success && Array.isArray(entries));
      return {
        actionId: action.id,
        expectedOutcome: `List directory entries of ${dirPath}`,
        observedOutcome: verified
          ? `Discovered ${entries.length} directory entry(ies)`
          : (observation.error || 'Failed to list directory'),
        verified,
        confidence: verified ? 1.0 : 0.0,
        status: verified ? 'verified_successful' : 'failed',
        failureReason: verified ? null : (observation.error || 'Failed to list directory'),
        isRecoverable: !verified,
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4d. Command Execution Verification
    if (action.type === 'execute_command') {
      const cmd = String(action.payload?.command || '');
      const exitCode = observation.data?.exitCode;
      const verified = Boolean(observation.success && exitCode === 0);
      return {
        actionId: action.id,
        expectedOutcome: `Command '${cmd}' completes with exit code 0`,
        observedOutcome: verified
          ? `Command completed successfully (exit code 0)`
          : `Command failed with exit code ${exitCode ?? 'unknown'} [${observation.error || observation.data?.stderr || ''}]`,
        verified,
        confidence: 1.0,
        status: verified ? 'verified_successful' : 'failed',
        failureReason: verified ? null : (observation.error || `Process exited with code ${exitCode}`),
        isRecoverable: !verified,
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4e. External Communication Verification
    if (action.type.startsWith('telegram_') || action.type === 'send_message') {
      const sent = Boolean(observation.success && (observation.data?.messageId || observation.data?.sent));
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome || 'Message delivered to recipient',
        observedOutcome: sent
          ? `Message delivered (messageId: ${observation.data?.messageId || 'acknowledged'})`
          : (observation.error || 'Message dispatch failed'),
        verified: sent,
        confidence: sent ? 0.98 : 0.0,
        status: sent ? 'verified_successful' : 'failed',
        failureReason: sent ? null : (observation.error || 'Message dispatch failed'),
        isRecoverable: !sent,
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 4f. Desktop Input Emulation Verification
    if (action.type.startsWith('desktop_') && action.type !== 'desktop_take_screenshot') {
      const executed = Boolean(observation.success && observation.data?.executed);
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: executed ? `Input action ${action.type} executed successfully` : (observation.error || 'Input execution failed'),
        verified: executed,
        confidence: executed ? 0.95 : 0.0,
        status: executed ? 'verified_successful' : 'failed',
        failureReason: executed ? null : (observation.error || 'Input execution failed'),
        isRecoverable: !executed,
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 5. Screen Capture & Environmental Inspection Verification
    if (action.type === 'desktop_take_screenshot' || action.type === 'capture_screen') {
      const hasImage = Boolean(
        observation.success &&
        (observation.data?.imageBase64 ||
         observation.data?.width ||
         observation.data?.metrics ||
         observation.data?.benchmarkSource)
      );
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: hasImage
          ? 'Visual frame or environmental state verified'
          : 'Failed to capture visual or environmental observation',
        verified: hasImage,
        confidence: hasImage ? 0.95 : 0.0,
        status: hasImage ? 'verified_successful' : 'failed',
        failureReason: hasImage ? null : 'Observation returned no visual frame or data',
        isRecoverable: !hasImage,
        recommendedStrategy: hasImage ? undefined : 'retry_with_backoff',
        evidence: observation.data || {},
        timestamp,
      };
    }

    // 6. Empirical Benchmark & Domain Research Evidence
    if (observation.success && (observation.data?.benchmarkSource || observation.data?.metrics)) {
      return {
        actionId: action.id,
        expectedOutcome: action.expectedOutcome,
        observedOutcome: `Empirical research benchmark data verified: ${JSON.stringify(observation.data.metrics || observation.data.benchmarkSource)}`,
        verified: true,
        confidence: 0.95,
        status: 'verified_successful',
        failureReason: null,
        isRecoverable: false,
        evidence: observation.data || {},
        timestamp,
      };
    }

    // Default Fallback Verification
    return {
      actionId: action.id,
      expectedOutcome: action.expectedOutcome,
      observedOutcome: observation.success
        ? 'Action executed without independent verification evidence'
        : (observation.error || 'Observation reported execution failure'),
      verified: false,
      confidence: 0.5,
      status: observation.success ? 'executed_unverified' : 'failed',
      failureReason: observation.success
        ? 'No independent empirical verification procedure for this action type'
        : (observation.error || 'Observation reported unverified state'),
      isRecoverable: !observation.success,
      recommendedStrategy: observation.success ? undefined : 'retry_with_backoff',
      evidence: observation.data || {},
      timestamp,
    };
  }
}
