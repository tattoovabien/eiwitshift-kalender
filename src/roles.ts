import type { AppNotification, Profile, Role, RoleId } from './types';

export const COORDINATOR_ORG = 'Departement Omgeving';

export const ROLES: Role[] = [
  { id: 'coordinator', label: 'Coördinator (Omgeving)', short: 'Coördinator', org: COORDINATOR_ORG, person: 'Coördinatie Green Deal' },
  { id: 'lidl', label: 'Partner: Lidl', short: 'Lidl', org: 'Lidl', person: 'Team Duurzaamheid' },
  { id: 'proveg', label: 'Partner: ProVeg', short: 'ProVeg', org: 'ProVeg', person: 'Team Campagnes' },
  { id: 'pbu', label: 'Partner: Plant-Based Universities', short: 'PBU', org: 'Plant-Based Universities', person: 'Kernteam PBU' },
  { id: 'anon', label: 'Niet ingelogd', short: 'Niet ingelogd', org: '', person: '' },
];

export function getRole(id: RoleId): Role {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

export function roleForOrg(org: string): Role | undefined {
  return ROLES.find((r) => r.org && r.org.toLowerCase() === org.toLowerCase());
}

/** Is this notification meant for the current user? Coordinators also get the coordinators' inbox. */
export function isForMe(n: AppNotification, role: Role): boolean {
  if (!role.org) return false;
  return n.toOrg === role.org || (role.id === 'coordinator' && n.toOrg === COORDINATOR_ORG);
}

export const ANON_ROLE: Role = ROLES.find((r) => r.id === 'anon')!;

/** Role of a real, logged-in user (live version). Pending or blocked users see what visitors see. */
export function roleFromProfile(p: Profile | null): Role {
  if (!p || p.status !== 'active' || !p.org) return ANON_ROLE;
  return {
    id: p.isCoordinator ? 'coordinator' : 'partner',
    label: p.isCoordinator ? `Coördinator (${p.org})` : `Partner: ${p.org}`,
    short: p.org,
    org: p.org,
    person: p.name || p.org,
  };
}
