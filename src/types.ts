export const MOMENT_TYPES = [
  'Campagne',
  'Event',
  'Webinar',
  'Workshop',
  'Publicatie',
  'Themadag',
  'Persbericht',
  'Andere',
] as const;
export type MomentType = (typeof MOMENT_TYPES)[number];

export const TARGET_GROUPS = [
  'Breed',
  'Consument',
  'Professionals',
  'Chefs & grootkeukens',
  'Zorg',
  'Hoger onderwijs',
  'Landbouwers',
  'Media',
] as const;
export type TargetGroup = (typeof TARGET_GROUPS)[number];

export const FOCUSES = ['100% plantaardig', 'halfhalf', 'breder eiwitshift'] as const;
export type Focus = (typeof FOCUSES)[number];

export const REGION_SUGGESTIONS = [
  'Vlaanderen',
  'Brussel',
  'Antwerpen',
  'Limburg',
  'Oost-Vlaanderen',
  'Vlaams-Brabant',
  'West-Vlaanderen',
  'Gent',
  'Brugge',
  'Leuven',
  'Hasselt',
  'Kortrijk',
  'Mechelen',
  'Online',
];

export interface Moment {
  id: string;
  title: string;
  /** ISO date (yyyy-mm-dd). Null only for open-ended moments without a known start. */
  startDate: string | null;
  /** ISO date, optional. */
  endDate?: string;
  /** Runs without an end date ("doorlopend" / "loopt door"). */
  ongoing: boolean;
  /** Timing not fixed yet: only the month of startDate is meaningful. */
  dateUnsure: boolean;
  /** Free-text hint when dateUnsure, e.g. "11 of 12 mei". */
  unsureNote?: string;
  type: MomentType;
  targetGroup: TargetGroup;
  focus: Focus;
  free: boolean;
  region: string;
  /** Main organising organisation (owns the moment). */
  organiser: string;
  /** Co-organisers, comma separated. They can also edit the moment. */
  coOrganisers?: string;
  isGreenDealPartner: boolean;
  link?: string;
  description?: string;
  halfhalfLink: boolean;
  /** What the organiser is looking for, e.g. "zoeken partners om mee te verspreiden". */
  need?: string;
  featured: boolean;
  customFields: Record<string, string>;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export type ReactionKind = 'join' | 'spread';

export interface Reaction {
  id: string;
  momentId: string;
  org: string;
  name: string;
  kind: ReactionKind;
  note?: string;
  /** "We zijn al in contact" */
  inContact: boolean;
  createdAt: string;
}

export interface Comment {
  id: string;
  momentId: string;
  org: string;
  text: string;
  createdAt: string;
  /** Live version: the user who wrote it (only they may edit it). */
  authorId?: string;
  editedAt?: string;
}

export const SIGNAL_KINDS = ['Mogelijke tegenstrijdigheid', 'Slechte timing', 'Andere bezorgdheid'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export interface Signal {
  id: string;
  momentId: string;
  kind: SignalKind;
  note?: string;
  anonymous: boolean;
  fromOrg: string;
  createdAt: string;
  resolved: boolean;
}

export type FieldType = 'text' | 'dropdown' | 'yesno';

export interface FieldDef {
  id: string;
  name: string;
  type: FieldType;
  options: string[];
  showInForm: boolean;
}

export type NotificationKind = 'reaction' | 'comment' | 'new_moment' | 'signal' | 'access_request';

export interface AppNotification {
  id: string;
  /** Organisation that receives it; COORDINATOR_ORG for the coordinators. */
  toOrg: string;
  /** Null for notifications that are not about a moment (access requests). */
  momentId: string | null;
  kind: NotificationKind;
  fromOrg: string;
  /** Extra context: reaction kind label, comment text, … */
  detail?: string;
  /** Id of the reaction, comment, signal or moment this is about (to open and highlight it). */
  refId?: string;
  createdAt: string;
  read: boolean;
}

/** Demo roles, plus 'partner' for real logged-in partners in the live version. */
export type RoleId = 'coordinator' | 'lidl' | 'proveg' | 'pbu' | 'anon' | 'partner';

export interface Role {
  id: RoleId;
  label: string;
  short: string;
  org: string;
  /** Display name used on reactions. */
  person: string;
}

/** A real user account (live version only). */
export interface Profile {
  userId: string;
  email: string;
  name: string;
  org: string | null;
  status: 'pending' | 'active' | 'blocked';
  isCoordinator: boolean;
  requestedOrg: string | null;
  feedToken: string;
  createdAt: string;
}

export interface AppState {
  version: number;
  role: RoleId;
  moments: Moment[];
  reactions: Reaction[];
  comments: Comment[];
  signals: Signal[];
  notifications: AppNotification[];
  fieldDefs: FieldDef[];
  /** Coordinators chose to send the digest automatically every month. */
  digestAuto?: boolean;
}
