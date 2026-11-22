import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseError, ILogger, rootLogger } from '@arletex/core';

export interface DatabaseConnectOptions {
  recoverCorruptFile?: boolean;
}

export class DatabaseService {
  private db: Database.Database | null = null;
  private readonly logger: ILogger;
  private readonly dbPath: string;
  public wasQuarantinedOnConnect = false;
  public quarantinedBackupPath: string | null = null;

  constructor(dbPath: string, logger: ILogger = rootLogger) {
    this.dbPath = dbPath;
    this.logger = logger.child('Database');
  }

  private applyPragmas(db: Database.Database): void {
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
    db.pragma('synchronous = NORMAL');
  }

  private quarantineCorruptFiles(): string {
    const timestamp = Date.now();
    const quarantinePath = `${this.dbPath}.corrupt.${timestamp}`;

    if (fs.existsSync(this.dbPath)) {
      fs.renameSync(this.dbPath, quarantinePath);
    }
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${this.dbPath}${suffix}`;
      if (fs.existsSync(sidecar)) {
        try {
          fs.renameSync(sidecar, `${quarantinePath}${suffix}`);
        } catch {}
      }
    }
    return quarantinePath;
  }

  public connect(options: DatabaseConnectOptions = {}): Database.Database {
    if (this.db) {
      return this.db;
    }

    this.wasQuarantinedOnConnect = false;
    this.quarantinedBackupPath = null;

    if (this.dbPath !== ':memory:') {
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const attemptOpen = (): Database.Database => {
      this.logger.info(`Opening database connection: ${this.dbPath}`);
      if (this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
        const stat = fs.statSync(this.dbPath);
        if (stat.size > 0) {
          const fd = fs.openSync(this.dbPath, 'r');
          try {
            const header = Buffer.alloc(Math.min(16, stat.size));
            fs.readSync(fd, header, 0, header.length, 0);
            if (header.toString('utf8') !== 'SQLite format 3\0') {
              throw new Error('SQLite header magic mismatch (file is not a valid SQLite database)');
            }
          } finally {
            fs.closeSync(fd);
          }
        }
      }
      const instance = new Database(this.dbPath);
      const checkResult = instance.pragma('quick_check', { simple: true });
      if (checkResult !== 'ok') {
        instance.close();
        throw new Error(`SQLite quick_check failed: ${String(checkResult)}`);
      }
      this.applyPragmas(instance);
      return instance;
    };

    try {
      this.db = attemptOpen();
      return this.db;
    } catch (error: any) {
      if (this.db) {
        try {
          this.db.close();
        } catch {}
        this.db = null;
      }

      if (options.recoverCorruptFile && this.dbPath !== ':memory:' && fs.existsSync(this.dbPath)) {
        this.logger.error(
          `Database file at ${this.dbPath} failed integrity check (${error?.message || error}). Quarantining corrupt file for out-of-band continuity restoration...`,
        );
        try {
          const quarantinePath = this.quarantineCorruptFiles();
          this.wasQuarantinedOnConnect = true;
          this.quarantinedBackupPath = quarantinePath;
          this.logger.warn(`Corrupted database quarantined at: ${quarantinePath}`);

          this.db = attemptOpen();
          return this.db;
        } catch (recoveryErr) {
          this.logger.error('Failed to initialize fresh database after quarantine', recoveryErr);
          throw new DatabaseError(
            `Failed to recover corrupted database at ${this.dbPath}`,
            recoveryErr,
          );
        }
      }

      this.logger.error('Failed to open database', error);
      throw new DatabaseError(`Failed to connect to database at ${this.dbPath}`, error);
    }
  }

  public getClient(): Database.Database {
    if (!this.db) {
      return this.connect();
    }
    return this.db;
  }

  public close(): void {
    if (this.db) {
      this.logger.info('Closing database connection');
      try {
        this.db.close();
      } catch (err) {
        this.logger.error('Error closing database', err);
      } finally {
        this.db = null;
      }
    }
  }
}
