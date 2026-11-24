import Database from 'better-sqlite3';
import {
  PersonalSpaceItem,
  PersonalSpaceAtmosphere,
  SpaceArrangementAction,
  PersonalSpaceLocation,
  PersonalSpaceItemCategory,
  PersonalSpaceItemState,
} from '@arletex/contracts';
import { DatabaseError, IPersonalEnvironmentRepository } from '@arletex/core';

export class SqlitePersonalEnvironmentRepository implements IPersonalEnvironmentRepository {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  public saveItem(item: PersonalSpaceItem): void {
    try {
      this.db
        .prepare(
          `INSERT INTO personal_space_items (
            id, name, category, location, description, significance, state, added_at, last_interacted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            category = excluded.category,
            location = excluded.location,
            description = excluded.description,
            significance = excluded.significance,
            state = excluded.state,
            last_interacted_at = excluded.last_interacted_at`,
        )
        .run(
          item.id,
          item.name,
          item.category,
          item.location,
          item.description,
          item.significance,
          item.state,
          item.addedAt,
          item.lastInteractedAt,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save personal space item ${item.id}: ${err.message}`, err);
    }
  }

  public getItem(id: string): PersonalSpaceItem | null {
    try {
      const row = this.db.prepare(`SELECT * FROM personal_space_items WHERE id = ?`).get(id) as any;
      if (!row) return null;
      return {
        id: row.id,
        name: row.name,
        category: row.category as PersonalSpaceItemCategory,
        location: row.location as PersonalSpaceLocation,
        description: row.description,
        significance: row.significance,
        state: row.state as PersonalSpaceItemState,
        addedAt: row.added_at,
        lastInteractedAt: row.last_interacted_at,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get personal space item ${id}: ${err.message}`, err);
    }
  }

  public listItems(location?: PersonalSpaceLocation): PersonalSpaceItem[] {
    try {
      let query = `SELECT * FROM personal_space_items`;
      const params: any[] = [];
      if (location) {
        query += ` WHERE location = ?`;
        params.push(location);
      }
      query += ` ORDER BY last_interacted_at DESC`;
      const rows = this.db.prepare(query).all(...params) as any[];
      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category as PersonalSpaceItemCategory,
        location: row.location as PersonalSpaceLocation,
        description: row.description,
        significance: row.significance,
        state: row.state as PersonalSpaceItemState,
        addedAt: row.added_at,
        lastInteractedAt: row.last_interacted_at,
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list personal space items: ${err.message}`, err);
    }
  }

  public deleteItem(id: string): void {
    try {
      this.db.prepare(`DELETE FROM personal_space_items WHERE id = ?`).run(id);
    } catch (err: any) {
      throw new DatabaseError(`Failed to delete personal space item ${id}: ${err.message}`, err);
    }
  }

  public saveAtmosphere(atmosphere: PersonalSpaceAtmosphere): void {
    try {
      this.db
        .prepare(
          `INSERT INTO personal_space_atmosphere (
            id, room_name, ambient_lighting, soundscape, scent_or_warmth, current_activity, weather_mood, last_updated
          ) VALUES ('current', ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            room_name = excluded.room_name,
            ambient_lighting = excluded.ambient_lighting,
            soundscape = excluded.soundscape,
            scent_or_warmth = excluded.scent_or_warmth,
            current_activity = excluded.current_activity,
            weather_mood = excluded.weather_mood,
            last_updated = excluded.last_updated`,
        )
        .run(
          atmosphere.roomName,
          atmosphere.ambientLighting,
          atmosphere.soundscape,
          atmosphere.scentOrWarmth,
          atmosphere.currentActivity,
          atmosphere.weatherMood,
          atmosphere.lastUpdated,
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save personal space atmosphere: ${err.message}`, err);
    }
  }

  public getAtmosphere(): PersonalSpaceAtmosphere | null {
    try {
      const row = this.db
        .prepare(`SELECT * FROM personal_space_atmosphere WHERE id = 'current'`)
        .get() as any;
      if (!row) return null;
      return {
        roomName: row.room_name,
        ambientLighting: row.ambient_lighting,
        soundscape: row.soundscape,
        scentOrWarmth: row.scent_or_warmth,
        currentActivity: row.current_activity,
        weatherMood: row.weather_mood,
        lastUpdated: row.last_updated,
      };
    } catch (err: any) {
      throw new DatabaseError(`Failed to get personal space atmosphere: ${err.message}`, err);
    }
  }

  public saveArrangementAction(action: SpaceArrangementAction): void {
    try {
      this.db
        .prepare(
          `INSERT INTO personal_space_arrangements (
            id, timestamp, action, reflection, items_involved
          ) VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          action.id,
          action.timestamp,
          action.action,
          action.reflection,
          JSON.stringify(action.itemsInvolved || []),
        );
    } catch (err: any) {
      throw new DatabaseError(`Failed to save arrangement action: ${err.message}`, err);
    }
  }

  public listArrangementActions(limit: number = 20): SpaceArrangementAction[] {
    try {
      const rows = this.db
        .prepare(`SELECT * FROM personal_space_arrangements ORDER BY timestamp DESC LIMIT ?`)
        .all(limit) as any[];
      return rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        action: row.action,
        reflection: row.reflection,
        itemsInvolved: JSON.parse(row.items_involved || '[]'),
      }));
    } catch (err: any) {
      throw new DatabaseError(`Failed to list arrangement actions: ${err.message}`, err);
    }
  }
}
