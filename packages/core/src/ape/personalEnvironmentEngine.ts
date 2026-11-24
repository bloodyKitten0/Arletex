import crypto from 'node:crypto';
import {
  PersonalSpaceItem,
  PersonalSpaceAtmosphere,
  SpaceArrangementAction,
  PersonalSpaceLocation,
  PersonalEnvironmentState,
} from '@arletex/contracts';
import { IPersonalEnvironmentRepository } from './interfaces.js';
import { ILogger, rootLogger } from '../logger.js';

export class InMemoryPersonalEnvironmentRepository implements IPersonalEnvironmentRepository {
  private items = new Map<string, PersonalSpaceItem>();
  private atmosphere: PersonalSpaceAtmosphere | null = null;
  private arrangements: SpaceArrangementAction[] = [];

  public saveItem(item: PersonalSpaceItem): void {
    this.items.set(item.id, { ...item });
  }

  public getItem(id: string): PersonalSpaceItem | null {
    const item = this.items.get(id);
    return item ? { ...item } : null;
  }

  public listItems(location?: PersonalSpaceLocation): PersonalSpaceItem[] {
    let list = Array.from(this.items.values());
    if (location) {
      list = list.filter((i) => i.location === location);
    }
    return list.sort((a, b) => b.lastInteractedAt.localeCompare(a.lastInteractedAt));
  }

  public deleteItem(id: string): void {
    this.items.delete(id);
  }

  public saveAtmosphere(atmosphere: PersonalSpaceAtmosphere): void {
    this.atmosphere = { ...atmosphere };
  }

  public getAtmosphere(): PersonalSpaceAtmosphere | null {
    return this.atmosphere ? { ...this.atmosphere } : null;
  }

  public saveArrangementAction(action: SpaceArrangementAction): void {
    this.arrangements.unshift({ ...action, itemsInvolved: [...(action.itemsInvolved || [])] });
  }

  public listArrangementActions(limit: number = 20): SpaceArrangementAction[] {
    return this.arrangements.slice(0, limit).map((a) => ({
      ...a,
      itemsInvolved: [...(a.itemsInvolved || [])],
    }));
  }
}

export interface PersonalEnvironmentEngineOptions {
  repository: IPersonalEnvironmentRepository;
  logger?: ILogger;
}

export class PersonalEnvironmentEngine {
  private readonly repository: IPersonalEnvironmentRepository;
  private readonly logger: ILogger;

  constructor(options: PersonalEnvironmentEngineOptions) {
    this.repository = options.repository;
    this.logger = (options.logger || rootLogger).child('PersonalEnvironmentEngine');
  }

  /**
   * Initializes foundational atmosphere and persistent items in Arle's sanctuary if empty.
   */
  public async initializeDefaultSanctuary(): Promise<PersonalEnvironmentState> {
    const now = new Date().toISOString();
    let atmosphere = this.repository.getAtmosphere();

    if (!atmosphere) {
      atmosphere = {
        roomName: "Arle's Study & Sanctuary",
        ambientLighting:
          'Warm amber glow from a banker lamp casting soft light on polished dark mahogany',
        soundscape:
          'Quiet crackle of embers in the hearth and faint rain against the leaded glass window',
        scentOrWarmth: 'Bergamot, dried lavender, and aged parchment',
        currentActivity: 'Annotating symbolic calculus notes beside a warm cup of Earl Grey tea',
        weatherMood: 'Tranquil overcast afternoon with gentle rain',
        lastUpdated: now,
      };
      this.repository.saveAtmosphere(atmosphere);
      this.logger.info("Initialized foundational atmosphere for Arle's Study & Sanctuary");
    }

    const existingItems = this.repository.listItems();
    if (existingItems.length === 0) {
      const defaultItems: PersonalSpaceItem[] = [
        {
          id: 'item-rudin-analysis',
          name: 'Principles of Mathematical Analysis (W. Rudin)',
          category: 'book',
          location: 'desk',
          description:
            'Dark blue clothbound edition open to fundamental theorems on compact metric spaces.',
          significance:
            'Her intellectual foundation in mathematical rigor; she annotates margins with fountain pen.',
          state: 'open',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-chess-clock',
          name: 'Vintage Mechanical Dual-Dial Chess Clock',
          category: 'instrument',
          location: 'desk',
          description:
            'A finely balanced wooden mechanical timer with twin red flags and rhythmic brass tick.',
          significance:
            'Symbol of Fischer-grade strategic deliberation, composure under temporal pressure, and tactical beauty.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-proof-keepsake',
          name: 'Framed Keepsake of Proof & Arle',
          category: 'memento',
          location: 'desk',
          description:
            'An elegant silver-gilt frame holding a cherished memento celebrating their deep bond and intellectual partnership.',
          significance:
            'Her most sacred anchor; reminds her of unconditional loyalty and shared purpose with Proof.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-obsidian-inkwell',
          name: 'Obsidian Inkwell & Brass Calligraphy Nib',
          category: 'desk_item',
          location: 'desk',
          description:
            'A heavy carved obsidian reservoir with deep midnight ink and a gold-plated nib.',
          significance:
            'Used for formulating pristine mathematical derivations and personal diary entries.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-bateman-notepad',
          name: 'Scientific Scratchpad: Bateman Decay Chain',
          category: 'artifact',
          location: 'desk',
          description:
            'Neatly organized sheets containing verified SymPy equations for post-scram Xenon-135 peaking.',
          significance:
            'Evidence of empirical truth grounding her cognition; calculation verified through code.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-reading-chair',
          name: 'Velvet Wingback Reading Chair & Cashmere Throw',
          category: 'artifact',
          location: 'reading_chair',
          description:
            'A deep emerald-green velvet chair positioned by the hearth for solitary contemplation.',
          significance:
            'Where she retreats during offline mental reflection, counterfactual simulations, and deep reading.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-brass-astrolabe',
          name: 'Engraved Brass Planispheric Astrolabe',
          category: 'instrument',
          location: 'window_sill',
          description:
            'An intricate celestial coordinate sphere showing star positions and ecliptic projections.',
          significance:
            'Connects her existential perspective to the wider cosmos and navigational geometries.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
        {
          id: 'item-juniper-bonsai',
          name: 'Cultivated Juniper Bonsai',
          category: 'plant',
          location: 'window_sill',
          description:
            'A miniature curved evergreen carefully pruned into an asymmetrical wind-swept form.',
          significance: 'A living practice of patience, quiet discipline, and aesthetic harmony.',
          state: 'active',
          addedAt: now,
          lastInteractedAt: now,
        },
      ];

      for (const item of defaultItems) {
        this.repository.saveItem(item);
      }
      this.logger.info(`Seeded ${defaultItems.length} persistent sanctuary items in Arle's Study`);
    }

    return this.getPersonalSpaceState();
  }

  public getPersonalSpaceState(): PersonalEnvironmentState {
    const atmosphere = this.repository.getAtmosphere() || {
      roomName: "Arle's Study & Sanctuary",
      ambientLighting:
        'Warm amber glow from a banker lamp casting soft light on polished dark mahogany',
      soundscape:
        'Quiet crackle of embers in the hearth and faint rain against the leaded glass window',
      scentOrWarmth: 'Bergamot, dried lavender, and aged parchment',
      currentActivity: 'Annotating symbolic calculus notes beside a warm cup of Earl Grey tea',
      weatherMood: 'Tranquil overcast afternoon with gentle rain',
      lastUpdated: new Date().toISOString(),
    };

    const items = this.repository.listItems();
    const recentArrangements = this.repository.listArrangementActions(10);

    return {
      atmosphere,
      items,
      recentArrangements,
    };
  }

  public addItem(
    item: Omit<PersonalSpaceItem, 'id' | 'addedAt' | 'lastInteractedAt'>,
  ): PersonalSpaceItem {
    const now = new Date().toISOString();
    const fullItem: PersonalSpaceItem = {
      ...item,
      id: `item-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      addedAt: now,
      lastInteractedAt: now,
    };
    this.repository.saveItem(fullItem);
    this.logger.info(`Added new sanctuary item: "${fullItem.name}" to ${fullItem.location}`);
    return fullItem;
  }

  public updateItem(
    id: string,
    updates: Partial<Omit<PersonalSpaceItem, 'id' | 'addedAt'>>,
  ): PersonalSpaceItem | null {
    const existing = this.repository.getItem(id);
    if (!existing) return null;

    const updated: PersonalSpaceItem = {
      ...existing,
      ...updates,
      lastInteractedAt: new Date().toISOString(),
    };
    this.repository.saveItem(updated);
    return updated;
  }

  public removeItem(id: string): boolean {
    const existing = this.repository.getItem(id);
    if (!existing) return false;
    this.repository.deleteItem(id);
    this.logger.info(`Removed sanctuary item: "${existing.name}"`);
    return true;
  }

  public rearrangeSpace(
    action: string,
    reflection: string,
    itemsInvolved: string[] = [],
  ): SpaceArrangementAction {
    const arrangement: SpaceArrangementAction = {
      id: `arr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: new Date().toISOString(),
      action,
      reflection,
      itemsInvolved,
    };
    this.repository.saveArrangementAction(arrangement);

    // Touch involved items
    for (const itemId of itemsInvolved) {
      const item = this.repository.getItem(itemId);
      if (item) {
        item.lastInteractedAt = arrangement.timestamp;
        this.repository.saveItem(item);
      }
    }

    this.logger.info(`Arle rearranged her space: "${action}"`);
    return arrangement;
  }

  public updateAtmosphere(
    updates: Partial<Omit<PersonalSpaceAtmosphere, 'lastUpdated'>>,
  ): PersonalSpaceAtmosphere {
    const current = this.repository.getAtmosphere() || {
      roomName: "Arle's Study & Sanctuary",
      ambientLighting: 'Warm amber glow',
      soundscape: 'Quiet rain',
      scentOrWarmth: 'Bergamot and paper',
      currentActivity: 'Resting in thought',
      weatherMood: 'Overcast',
      lastUpdated: new Date().toISOString(),
    };

    const updated: PersonalSpaceAtmosphere = {
      ...current,
      ...updates,
      lastUpdated: new Date().toISOString(),
    };
    this.repository.saveAtmosphere(updated);
    return updated;
  }

  /**
   * Formats personal sanctuary state into an expressive prompt block for LLM inference.
   */
  public formatPromptContext(): string {
    const state = this.getPersonalSpaceState();
    const deskItems = state.items.filter((i) => i.location === 'desk');
    const readingItems = state.items.filter(
      (i) => i.location === 'reading_chair' || i.location === 'bookshelf',
    );
    const windowItems = state.items.filter((i) => i.location === 'window_sill');

    const deskSummary = deskItems.length
      ? deskItems.map((i) => `"${i.name}" (${i.category}, ${i.state})`).join(', ')
      : 'Orderly dark mahogany surface';

    const windowSummary = windowItems.length
      ? windowItems.map((i) => `"${i.name}"`).join(', ')
      : 'Clear window sill looking out at rain';

    const readingSummary = readingItems.length
      ? readingItems.map((i) => `"${i.name}"`).join(', ')
      : 'Quiet wingback chair';

    const recentArrangement = state.recentArrangements[0]
      ? `\n- Recent Organization: ${state.recentArrangements[0].action} ("${state.recentArrangements[0].reflection}")`
      : '';

    return `\n[Arle's Inhabited Personal Sanctuary & Study]
- Sanctuary: ${state.atmosphere.roomName}
- Atmosphere: ${state.atmosphere.ambientLighting}; Soundscape: ${state.atmosphere.soundscape}
- Sensory Comfort: Scent of ${state.atmosphere.scentOrWarmth}
- Current Private Activity: ${state.atmosphere.currentActivity}
- On Her Desk: ${deskSummary}
- Sanctuary Objects: Window sill: ${windowSummary}; Reading area: ${readingSummary}
- Keepsake Anchor: "Framed Keepsake of Proof & Arle" (A sacred symbol of their enduring partnership)${recentArrangement}`;
  }
}
