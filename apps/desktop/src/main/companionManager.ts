import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'node:path';
import { CompanionAnimation, DesktopCompanionState, IPC_CHANNELS } from '@arletex/contracts';
import { rootLogger } from '@arletex/core';

const logger = rootLogger.child('CompanionManager');

export class CompanionManager {
  private companionWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow | null = null;
  private state: DesktopCompanionState = {
    visible: true,
    activeAnimation: 'idle',
    character: 'girl_1',
    x: 100,
    y: 100,
    flipX: false,
    isSpeaking: false,
    isDragging: false,
  };

  constructor() {
    this.registerIpcHandlers();
  }

  public setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  public getCompanionWindow(): BrowserWindow | null {
    return this.companionWindow;
  }

  public async initCompanionWindow(
    preloadPath: string,
    isDev: boolean,
    devUrl?: string,
  ): Promise<BrowserWindow> {
    if (this.companionWindow && !this.companionWindow.isDestroyed()) {
      return this.companionWindow;
    }

    const primary = screen.getPrimaryDisplay();
    const { width, height } = primary.workAreaSize;
    const initialX = Math.max(0, width - 200);
    const initialY = Math.max(0, height - 200);

    this.state.x = initialX;
    this.state.y = initialY;

    this.companionWindow = new BrowserWindow({
      width: 180,
      height: 180,
      x: initialX,
      y: initialY,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      hasShadow: false,
      skipTaskbar: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    this.companionWindow.removeMenu();
    this.companionWindow.setAlwaysOnTop(true, 'screen-saver');
    try {
      this.companionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch {}

    if (isDev && devUrl) {
      await this.companionWindow.loadURL(`${devUrl}#companion`);
    } else {
      const indexPath = path.join(__dirname, '../renderer/index.html');
      await this.companionWindow.loadFile(indexPath, { hash: 'companion' });
    }

    this.companionWindow.on('closed', () => {
      this.companionWindow = null;
      this.state.visible = false;
      this.broadcastState();
    });

    logger.info(`Desktop Companion window launched at (${initialX}, ${initialY})`);
    return this.companionWindow;
  }

  public toggle(): boolean {
    if (!this.companionWindow || this.companionWindow.isDestroyed()) {
      return false;
    }

    if (this.companionWindow.isVisible()) {
      this.companionWindow.hide();
      this.state.visible = false;
    } else {
      this.companionWindow.show();
      this.state.visible = true;
    }
    this.broadcastState();
    return this.state.visible;
  }

  public setAnimation(animation: CompanionAnimation): void {
    this.state.activeAnimation = animation;
    this.broadcastState();
  }

  public setSpeaking(isSpeaking: boolean, text?: string): void {
    this.state.isSpeaking = isSpeaking;
    this.state.currentSpeechText = text;
    this.state.activeAnimation = isSpeaking ? 'dialogue' : 'idle';
    this.broadcastState();
  }

  public getState(): DesktopCompanionState {
    return { ...this.state };
  }

  public updateState(patch: Partial<DesktopCompanionState>): DesktopCompanionState {
    this.state = { ...this.state, ...patch };
    this.broadcastState();
    return this.getState();
  }

  public broadcastState(): void {
    const payload = this.getState();
    if (this.companionWindow && !this.companionWindow.isDestroyed()) {
      this.companionWindow.webContents.send(IPC_CHANNELS.COMPANION_STATE_CHANGED, payload);
    }
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(IPC_CHANNELS.COMPANION_STATE_CHANGED, payload);
    }
  }

  private registerIpcHandlers(): void {
    ipcMain.handle(IPC_CHANNELS.COMPANION_TOGGLE, async () => {
      const visible = this.toggle();
      return { success: true, data: { visible } };
    });

    ipcMain.handle(IPC_CHANNELS.COMPANION_STATE_GET, async () => {
      return { success: true, data: this.getState() };
    });

    ipcMain.handle(IPC_CHANNELS.COMPANION_STATE_UPDATE, async (_event, patch) => {
      const updated = this.updateState(patch || {});
      return { success: true, data: updated };
    });

    ipcMain.handle(IPC_CHANNELS.COMPANION_MOVE, async (_event, { deltaX, deltaY }) => {
      if (!this.companionWindow || this.companionWindow.isDestroyed()) {
        return { success: false, error: 'Companion window not active' };
      }
      const [curX, curY] = this.companionWindow.getPosition();
      const newX = curX + (deltaX || 0);
      const newY = curY + (deltaY || 0);
      this.companionWindow.setPosition(newX, newY);
      this.state.x = newX;
      this.state.y = newY;
      return { success: true, data: { x: newX, y: newY } };
    });

    ipcMain.handle(IPC_CHANNELS.COMPANION_FOCUS_MAIN, async () => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.show();
        this.mainWindow.focus();
        return { success: true, data: true };
      }
      return { success: false, error: 'Main window not available' };
    });
  }
}

export const defaultCompanionManager = new CompanionManager();
