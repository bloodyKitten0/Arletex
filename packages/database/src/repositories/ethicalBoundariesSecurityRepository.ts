import Database from 'better-sqlite3';
import {
  SecurityAuthorizationDecision,
  SecurityAuditLog,
  SecurityBoundaryPolicy,
  SecurityActionCategory,
  SecurityAuditEventType,
} from '@arletex/contracts';
import { DatabaseError, IEthicalBoundariesSecurityRepository } from '@arletex/core';

export class SqliteEthicalBoundariesSecurityRepository implements IEthicalBoundariesSecurityRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveDecision(decision: SecurityAuthorizationDecision): void {
    try {
      this.db
        .prepare(
          `INSERT INTO security_authorization_decisions (
            decision_id, action_category, target_resource, requested_permission,
            allowed, fail_closed_reason, approval_required, is_approved,
            prompt_injection_detected, injection_markers, audit_notes, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(decision_id) DO UPDATE SET
            action_category = excluded.action_category,
            target_resource = excluded.target_resource,
            requested_permission = excluded.requested_permission,
            allowed = excluded.allowed,
            fail_closed_reason = excluded.fail_closed_reason,
            approval_required = excluded.approval_required,
            is_approved = excluded.is_approved,
            prompt_injection_detected = excluded.prompt_injection_detected,
            injection_markers = excluded.injection_markers,
            audit_notes = excluded.audit_notes,
            timestamp = excluded.timestamp`,
        )
        .run(
          decision.decisionId,
          decision.actionCategory,
          decision.targetResource,
          decision.requestedPermission,
          decision.allowed ? 1 : 0,
          decision.failClosedReason ?? null,
          decision.approvalRequired ? 1 : 0,
          decision.isApproved ? 1 : 0,
          decision.promptInjectionDetected ? 1 : 0,
          JSON.stringify(decision.injectionMarkers ?? []),
          decision.auditNotes,
          decision.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save security decision ${decision.decisionId}: ${err.message}`,
        err,
      );
    }
  }

  public getDecision(id: string): SecurityAuthorizationDecision | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM security_authorization_decisions WHERE decision_id = ?`)
        .get(id) as any;
      if (!row) return null;
      return this.mapDecisionRow(row);
    } catch (err: any) {
      throw new DatabaseError(`Failed to get security decision ${id}: ${err.message}`, err);
    }
  }

  public listDecisions(filter?: {
    actionCategory?: SecurityActionCategory;
    allowed?: boolean;
    limit?: number;
  }): SecurityAuthorizationDecision[] {
    try {
      let query = `SELECT * FROM security_authorization_decisions`;
      const clauses: string[] = [];
      const params: any[] = [];

      if (filter?.actionCategory) {
        clauses.push(`action_category = ?`);
        params.push(filter.actionCategory);
      }
      if (filter?.allowed !== undefined) {
        clauses.push(`allowed = ?`);
        params.push(filter.allowed ? 1 : 0);
      }

      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ');
      }

      query += ` ORDER BY timestamp DESC`;
      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => this.mapDecisionRow(r));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list security decisions: ${err.message}`, err);
    }
  }

  public saveAuditLog(log: SecurityAuditLog): void {
    try {
      this.db
        .prepare(
          `INSERT INTO security_audit_logs (
            id, event_type, action_category, severity, details, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            event_type = excluded.event_type,
            action_category = excluded.action_category,
            severity = excluded.severity,
            details = excluded.details,
            timestamp = excluded.timestamp`,
        )
        .run(
          log.id,
          log.eventType,
          log.actionCategory,
          log.severity,
          JSON.stringify(log.details ?? {}),
          log.timestamp,
        );
    } catch (err: any) {
      throw new DatabaseError(
        `Failed to save security audit log ${log.id}: ${err.message}`,
        err,
      );
    }
  }

  public listAuditLogs(filter?: {
    eventType?: SecurityAuditEventType;
    limit?: number;
  }): SecurityAuditLog[] {
    try {
      let query = `SELECT * FROM security_audit_logs`;
      const clauses: string[] = [];
      const params: any[] = [];

      if (filter?.eventType) {
        clauses.push(`event_type = ?`);
        params.push(filter.eventType);
      }

      if (clauses.length > 0) {
        query += ` WHERE ` + clauses.join(' AND ');
      }

      query += ` ORDER BY timestamp DESC`;
      if (filter?.limit) {
        query += ` LIMIT ?`;
        params.push(filter.limit);
      }

      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        actionCategory: r.action_category,
        severity: r.severity,
        details: JSON.parse(r.details || '{}'),
        timestamp: r.timestamp,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list security audit logs: ${err.message}`, err);
    }
  }

  public getPolicyState(): SecurityBoundaryPolicy | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM security_policy_state WHERE id = 'current_policy'`)
        .get() as any;
      if (!row) return null;
      const policy = JSON.parse(row.policy_json);
      return {
        ...policy,
        emergencyShutdownActive: Boolean(row.emergency_shutdown),
        emergencyShutdownReason: row.shutdown_reason ?? undefined,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get security policy state: ${err.message}`, err);
    }
  }

  public savePolicyState(policy: SecurityBoundaryPolicy): void {
    try {
      this.db
        .prepare(
          `INSERT INTO security_policy_state (
            id, policy_json, emergency_shutdown, shutdown_reason, updated_at
          ) VALUES ('current_policy', ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO UPDATE SET
            policy_json = excluded.policy_json,
            emergency_shutdown = excluded.emergency_shutdown,
            shutdown_reason = excluded.shutdown_reason,
            updated_at = CURRENT_TIMESTAMP`,
        )
        .run(
          JSON.stringify(policy),
          policy.emergencyShutdownActive ? 1 : 0,
          policy.emergencyShutdownReason ?? null,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save security policy state: ${err.message}`, err);
    }
  }

  private mapDecisionRow(row: any): SecurityAuthorizationDecision {
    return {
      decisionId: row.decision_id,
      actionCategory: row.action_category,
      targetResource: row.target_resource,
      requestedPermission: row.requested_permission,
      allowed: Boolean(row.allowed),
      failClosedReason: row.fail_closed_reason ?? undefined,
      approvalRequired: Boolean(row.approval_required),
      isApproved: Boolean(row.is_approved),
      promptInjectionDetected: Boolean(row.prompt_injection_detected),
      injectionMarkers: JSON.parse(row.injection_markers || '[]'),
      auditNotes: row.audit_notes,
      timestamp: row.timestamp,
    };
  }
}
