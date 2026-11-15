import { spawn, execFile, ChildProcessWithoutNullStreams } from 'node:child_process';
import util from 'node:util';
import crypto from 'node:crypto';
import { rootLogger, ILogger } from '@arletex/core';

const execFilePromise = util.promisify(execFile);

export interface DesktopNotification {
  id: string;
  appName: string;
  summary: string;
  body: string;
  receivedAt: string;
  isTelegram: boolean;
  isGoogle: boolean;
  isFromPartner: boolean;
}

export type NotificationCallback = (notification: DesktopNotification) => Promise<void> | void;

export class NotificationListenerService {
  private logger: ILogger;
  private monitorProcess: ChildProcessWithoutNullStreams | null = null;
  private isListening = false;
  private listeners: NotificationCallback[] = [];
  private recentNotificationHashes = new Set<string>();

  constructor(logger: ILogger = rootLogger) {
    this.logger = logger.child('NotificationListenerService');
  }

  public addListener(callback: NotificationCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  public isRunning(): boolean {
    return this.isListening;
  }

  /**
   * Starts monitoring Linux desktop notifications via D-Bus session bus.
   */
  public start(): boolean {
    if (this.isListening) {
      return true;
    }

    try {
      this.logger.info('Starting dbus-monitor for desktop notifications...');
      this.monitorProcess = spawn('dbus-monitor', [
        '--session',
        "interface='org.freedesktop.Notifications',member='Notify'",
      ]);

      this.isListening = true;
      let buffer = '';

      this.monitorProcess.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        // A full Notify method call block in dbus-monitor output
        if (buffer.includes('method call') && buffer.includes('int32')) {
          const blocks = buffer.split('method call');
          for (let i = 0; i < blocks.length - 1; i++) {
            const block = blocks[i]?.trim();
            if (block && block.includes('member=Notify')) {
              this.parseAndDispatchNotification(block);
            }
          }
          buffer = blocks[blocks.length - 1] || '';
        }
      });

      this.monitorProcess.stderr.on('data', (chunk: Buffer) => {
        this.logger.debug(`dbus-monitor stderr: ${chunk.toString().trim()}`);
      });

      this.monitorProcess.on('exit', (code, signal) => {
        this.logger.warn(`dbus-monitor exited with code ${code}, signal ${signal}`);
        this.isListening = false;
        this.monitorProcess = null;
      });

      return true;
    } catch (err: any) {
      this.logger.error('Failed to start dbus-monitor notification listener', err);
      this.isListening = false;
      return false;
    }
  }

  public stop(): void {
    if (this.monitorProcess) {
      this.monitorProcess.kill();
      this.monitorProcess = null;
    }
    this.isListening = false;
    this.logger.info('NotificationListenerService stopped.');
  }

  /**
   * Parses raw dbus-monitor text block into a DesktopNotification.
   */
  public parseAndDispatchNotification(block: string): DesktopNotification | null {
    try {
      // Extract string literals in order from the dbus method call
      // Typical order in Notify: app_name, uint32, app_icon, summary, body
      const stringMatches: string[] = [];
      const regex = /string "(.*?)"/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(block)) !== null) {
        stringMatches.push(match[1] || '');
      }

      if (stringMatches.length < 2) {
        return null;
      }

      const appName = stringMatches[0] || 'Unknown App';
      // If Arle herself emitted this notification, ignore it to prevent feedback loops
      if (appName.toLowerCase().includes('arle') || appName.toLowerCase().includes('arletex')) {
        return null;
      }

      // D-Bus Notify format: [0]=app_name, [1]=app_icon, [2]=summary, [3]=body
      const summary = stringMatches.length >= 4 ? (stringMatches[2] || '') : (stringMatches[1] || '');
      const body = stringMatches.length >= 4 ? (stringMatches[3] || '') : (stringMatches[2] || '');

      const contentSignature = `${appName}:${summary}:${body}`;
      if (this.recentNotificationHashes.has(contentSignature)) {
        return null;
      }
      this.recentNotificationHashes.add(contentSignature);
      // Clean old hashes periodically
      if (this.recentNotificationHashes.size > 200) {
        this.recentNotificationHashes.clear();
      }

      const lowerAppName = appName.toLowerCase();
      const lowerSummary = summary.toLowerCase();
      const lowerBody = body.toLowerCase();

      const isTelegram =
        lowerAppName.includes('telegram') ||
        lowerSummary.includes('telegram') ||
        lowerBody.includes('telegram');

      const isGoogle =
        lowerAppName.includes('chrome') ||
        lowerAppName.includes('google') ||
        lowerSummary.includes('google');

      const isFromPartner =
        lowerSummary.includes('proof') ||
        lowerBody.includes('proof') ||
        isTelegram;

      const notification: DesktopNotification = {
        id: crypto.randomUUID(),
        appName,
        summary,
        body,
        receivedAt: new Date().toISOString(),
        isTelegram,
        isGoogle,
        isFromPartner,
      };

      this.logger.info(
        `Captured notification from ${appName}: "${summary}" - "${body.slice(0, 60)}"`,
      );

      // Dispatch to all listeners
      for (const listener of this.listeners) {
        try {
          listener(notification);
        } catch (err) {
          this.logger.error('Error in notification listener callback', err);
        }
      }

      return notification;
    } catch (err: any) {
      this.logger.error('Failed to parse notification block', err);
      return null;
    }
  }

  /**
   * Sends an answer or notification back to the Linux desktop display via notify-send.
   */
  public async sendDesktopNotification(
    title: string,
    message: string,
    urgency: 'low' | 'normal' | 'critical' = 'normal',
  ): Promise<boolean> {
    try {
      const validUrgency = ['low', 'normal', 'critical'].includes(urgency) ? urgency : 'normal';
      const display = process.env.DISPLAY || ':0';
      await execFilePromise(
        'notify-send',
        ['-a', 'Arle', '-u', validUrgency, String(title), String(message)],
        {
          env: { ...process.env, DISPLAY: display },
          timeout: 5000,
        },
      );
      return true;
    } catch (err: any) {
      this.logger.error('Failed to send desktop notification via notify-send', err);
      return false;
    }
  }

  /**
   * For automated testing and simulated external events.
   */
  public simulateNotification(
    appName: string,
    summary: string,
    body: string,
  ): DesktopNotification {
    const rawBlock = `
method call time=1000.0 sender=:1.1 -> destination=:1.2 serial=1 path=/org/freedesktop/Notifications; interface=org.freedesktop.Notifications; member=Notify
   string "${appName}"
   uint32 0
   string ""
   string "${summary}"
   string "${body}"
   array [
   ]
   int32 -1
    `;
    const notification = this.parseAndDispatchNotification(rawBlock);
    if (!notification) {
      const fallback: DesktopNotification = {
        id: crypto.randomUUID(),
        appName,
        summary,
        body,
        receivedAt: new Date().toISOString(),
        isTelegram: appName.toLowerCase().includes('telegram'),
        isGoogle: appName.toLowerCase().includes('google') || appName.toLowerCase().includes('chrome'),
        isFromPartner: true,
      };
      for (const l of this.listeners) l(fallback);
      return fallback;
    }
    return notification;
  }
}

export const defaultNotificationListener = new NotificationListenerService();
