// Converts between database rows (snake_case, Supabase) and the app's types.
// Also used by the edge functions (copied by scripts/sync-shared.mjs), so keep it free of browser APIs.
import type {
  AppNotification,
  Comment,
  FieldDef,
  Focus,
  Moment,
  MomentType,
  Profile,
  Reaction,
  Signal,
  SignalKind,
  TargetGroup,
} from '../types';
import { COORDINATOR_ORG } from '../roles';
import { orgsOf } from '../lib/moments';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const opt = (v: unknown) => (v === null || v === undefined || v === '' ? undefined : (v as string));

export function momentFromRow(r: Row): Moment {
  return {
    id: r.id,
    title: r.title,
    startDate: r.start_date ?? null,
    endDate: opt(r.end_date),
    ongoing: !!r.ongoing,
    dateUnsure: !!r.date_unsure,
    unsureNote: opt(r.unsure_note),
    type: r.type as MomentType,
    targetGroup: r.target_group as TargetGroup,
    focus: r.focus as Focus,
    free: !!r.free,
    region: r.region ?? '',
    organiser: r.organiser,
    coOrganisers: opt(r.co_organisers),
    isGreenDealPartner: !!r.is_green_deal_partner,
    link: opt(r.link),
    description: opt(r.description),
    halfhalfLink: !!r.halfhalf_link,
    need: opt(r.need),
    featured: !!r.featured,
    customFields: r.custom_fields ?? {},
    createdBy: r.created_by_org || r.organiser,
    createdAt: r.created_at,
    updatedAt: opt(r.updated_at),
  };
}

/** Columns the app may write. Who created it and when is filled in by the database. */
export function momentToRow(m: Moment): Row {
  return {
    id: m.id,
    title: m.title,
    start_date: m.startDate,
    end_date: m.endDate ?? null,
    ongoing: m.ongoing,
    date_unsure: m.dateUnsure,
    unsure_note: m.unsureNote ?? null,
    type: m.type,
    target_group: m.targetGroup,
    focus: m.focus,
    free: m.free,
    region: m.region,
    organiser: m.organiser,
    co_organisers: m.coOrganisers ?? null,
    owner_orgs: orgsOf(m),
    is_green_deal_partner: m.isGreenDealPartner,
    link: m.link ?? null,
    description: m.description ?? null,
    halfhalf_link: m.halfhalfLink,
    need: m.need ?? null,
    featured: m.featured,
    custom_fields: m.customFields,
  };
}

/** Visitors who are not logged in only get titles and dates. */
export function publicMomentFromRow(r: Row): Moment {
  return {
    id: r.id,
    title: r.title,
    startDate: r.start_date ?? null,
    endDate: opt(r.end_date),
    ongoing: !!r.ongoing,
    dateUnsure: !!r.date_unsure,
    unsureNote: opt(r.unsure_note),
    type: 'Andere',
    targetGroup: 'Breed',
    focus: 'breder eiwitshift',
    free: true,
    region: '',
    organiser: '',
    isGreenDealPartner: false,
    halfhalfLink: false,
    featured: false,
    customFields: {},
    createdBy: '',
    createdAt: '',
  };
}

export function reactionFromRow(r: Row): Reaction {
  return {
    id: r.id,
    momentId: r.moment_id,
    org: r.org,
    name: r.name,
    kind: r.kind,
    note: opt(r.note),
    inContact: !!r.in_contact,
    createdAt: r.created_at,
  };
}

export function commentFromRow(r: Row): Comment {
  return { id: r.id, momentId: r.moment_id, org: r.org, text: r.text, createdAt: r.created_at };
}

export function signalFromRow(r: Row): Signal {
  return {
    id: r.id,
    momentId: r.moment_id,
    kind: r.kind as SignalKind,
    note: opt(r.note),
    anonymous: !!r.anonymous,
    fromOrg: r.from_org ?? 'Anoniem',
    createdAt: r.created_at,
    resolved: !!r.resolved,
  };
}

export function notificationFromRow(r: Row): AppNotification {
  return {
    id: r.id,
    toOrg: r.to_coordinators ? COORDINATOR_ORG : r.to_org,
    momentId: r.moment_id ?? null,
    kind: r.kind,
    fromOrg: r.from_org,
    detail: opt(r.detail),
    createdAt: r.created_at,
    read: !!r.read,
  };
}

export function fieldDefFromRow(r: Row): FieldDef {
  return { id: r.id, name: r.name, type: r.type, options: r.options ?? [], showInForm: !!r.show_in_form };
}

export function fieldDefToRow(d: FieldDef): Row {
  return { id: d.id, name: d.name, type: d.type, options: d.options, show_in_form: d.showInForm };
}

export function profileFromRow(r: Row): Profile {
  return {
    userId: r.user_id,
    email: r.email,
    name: r.name ?? '',
    org: r.org ?? null,
    status: r.status,
    isCoordinator: !!r.is_coordinator,
    requestedOrg: r.requested_org ?? null,
    feedToken: r.feed_token,
    createdAt: r.created_at,
  };
}
