import { z } from 'zod';

export const PERSONAL_SPACE_ITEM_CATEGORIES = [
  'desk_item',
  'book',
  'artifact',
  'memento',
  'instrument',
  'plant',
  'art',
] as const;
export const PersonalSpaceItemCategorySchema = z.enum(PERSONAL_SPACE_ITEM_CATEGORIES);
export type PersonalSpaceItemCategory = z.infer<typeof PersonalSpaceItemCategorySchema>;

export const PERSONAL_SPACE_LOCATIONS = [
  'desk',
  'bookshelf',
  'side_table',
  'wall',
  'window_sill',
  'reading_chair',
] as const;
export const PersonalSpaceLocationSchema = z.enum(PERSONAL_SPACE_LOCATIONS);
export type PersonalSpaceLocation = z.infer<typeof PersonalSpaceLocationSchema>;

export const PERSONAL_SPACE_ITEM_STATES = ['active', 'stored', 'open', 'contemplating'] as const;
export const PersonalSpaceItemStateSchema = z.enum(PERSONAL_SPACE_ITEM_STATES);
export type PersonalSpaceItemState = z.infer<typeof PersonalSpaceItemStateSchema>;

export const PersonalSpaceItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  category: PersonalSpaceItemCategorySchema,
  location: PersonalSpaceLocationSchema,
  description: z.string().min(1),
  significance: z.string().min(1),
  state: PersonalSpaceItemStateSchema.default('active'),
  addedAt: z.string(),
  lastInteractedAt: z.string(),
});
export type PersonalSpaceItem = z.infer<typeof PersonalSpaceItemSchema>;

export const PersonalSpaceAtmosphereSchema = z.object({
  roomName: z.string().min(1).default("Arle's Study & Sanctuary"),
  ambientLighting: z.string().min(1),
  soundscape: z.string().min(1),
  scentOrWarmth: z.string().min(1),
  currentActivity: z.string().min(1),
  weatherMood: z.string().min(1),
  lastUpdated: z.string(),
});
export type PersonalSpaceAtmosphere = z.infer<typeof PersonalSpaceAtmosphereSchema>;

export const SpaceArrangementActionSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  action: z.string().min(1),
  reflection: z.string().min(1),
  itemsInvolved: z.array(z.string()).default([]),
});
export type SpaceArrangementAction = z.infer<typeof SpaceArrangementActionSchema>;

export const PersonalEnvironmentStateSchema = z.object({
  atmosphere: PersonalSpaceAtmosphereSchema,
  items: z.array(PersonalSpaceItemSchema),
  recentArrangements: z.array(SpaceArrangementActionSchema),
});
export type PersonalEnvironmentState = z.infer<typeof PersonalEnvironmentStateSchema>;
