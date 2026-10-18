import {alive} from './shared.js';
import {CHAPTERS} from '../data/campaign.js';

// A small roll of service, not a second army-management game. Recovery can
// soften the next deployment, but never removes a veteran or blocks progress.
const OTHER_VETERANS = [
  ['naso', 'Aulus Naso'], ['felix', 'Marcus Felix'],
  ['firmus', 'Titus Firmus'], ['rufus', 'Gnaeus Rufus'],
];
export const VETERAN_IDS = ['lucan', 'sabinus', ...OTHER_VETERANS.map(([id]) => id)];

export function createCompany(state = {}) {
  const companion = state.decisions?.ch2 === 'leave' ? ['sabinus', 'Sabinus'] : ['lucan', 'Aurelius Lucan'];
  return [companion, ...OTHER_VETERANS].map(([id, name]) => ({id, name, service: 0, commendations: 0, recovery: 0}));
}

export function normalizeCareer(state) {
  if (state.company === undefined) state.company = createCompany(state);
  if (state.storyProgress === undefined) state.storyProgress = {};
  return state;
}

export function companyRoster(state) {
  return (state.company || createCompany(state)).map(veteran => ({...veteran}));
}

export function replaceFallenComrade(state) {
  const index = state.company?.findIndex(veteran => veteran.id === 'lucan') ?? -1;
  if (index >= 0) state.company[index] = {id: 'sabinus', name: 'Sabinus', service: 0, commendations: 0, recovery: 0};
}

// Called only by a successful, unique encounter commit. Preview, combat and
// retries leave the campaign company unchanged until that transaction ends.
export function recordCompanyService(state, encounter) {
  normalizeCareer(state);
  for (const veteran of state.company) veteran.recovery = Math.max(0, veteran.recovery - 1);
  if (encounter.kind !== 'battle') return [];
  const allies = encounter.units.filter(unit => unit.side === 'ally' || (unit.side === 'neutral' && unit.role === 'escort' && unit.veteranId));
  const allReturned = allies.every(alive);
  const reports = [];
  allies.forEach(unit => {
    // Only the old army's ally0…allyN slots may use the compatibility mapping.
    // A defecting enemy is not an undeployed veteran from the company roll.
    const legacyIndex = !encounter.scenario ? /^ally(\d+)$/.exec(unit.id)?.[1] : undefined;
    const id = unit.veteranId || (legacyIndex !== undefined ? state.company[Number(legacyIndex)]?.id : undefined);
    const veteran = state.company.find(member => member.id === id);
    if (!veteran || reports.some(report => report.id === id)) return;
    const withdrawn = !alive(unit);
    const wounded = !withdrawn && unit.hp <= Math.ceil(unit.maxHp / 3);
    veteran.service = Math.min(99, veteran.service + 1);
    if (allReturned) veteran.commendations = Math.min(12, veteran.commendations + 1);
    veteran.recovery = Math.max(veteran.recovery, withdrawn ? 2 : wounded ? 1 : 0);
    reports.push({id, name: veteran.name, withdrawn, wounded, commended: allReturned});
  });
  return reports;
}

export function leadershipSummary(state, chapter = state.chapter) {
  const records = (state.history || []).filter(record => record.chapter === chapter);
  if (!records.length) {
    if (!(state.history || []).length) return 'Your company’s roll will record service, safe returns, and the recovery owed to wounded veterans.';
    const roster = companyRoster(state), ready = roster.filter(veteran => veteran.recovery === 0).length;
    const service = roster.reduce((total, veteran) => total + veteran.service, 0), commendations = roster.reduce((total, veteran) => total + veteran.commendations, 0);
    return `Your chronicle records ${state.history.length} completed ${state.history.length === 1 ? 'encounter' : 'encounters'}. ${ready} of ${roster.length} veterans are at full strength. The current company roll carries ${service} individual deployments and ${commendations} commendations.${ready < roster.length ? ' The remaining veterans stay with the company while they recover.' : ''}`;
  }
  const fields = records.filter(record => record.kind === 'battle' && record.id !== 'ch1-training');
  if (!fields.length && records.every(record => record.id === 'ch1-training')) return 'Training is complete. No allied formation has deployed yet; the company’s field record begins with your first assignment beyond the gate.';
  const losses = fields.reduce((sum, record) => sum + (record.losses || 0), 0);
  const honoured = [...new Set(records.flatMap(record => (record.veterans || []).filter(veteran => veteran.commended).map(veteran => veteran.name)))];
  const recovering = companyRoster(state).filter(veteran => veteran.recovery > 0);
  const conduct = !fields.length
    ? 'Your civil appointment rests on arguments won and undertakings entered into the public record.'
    : losses === 0
      ? `Across ${fields.length} field ${fields.length === 1 ? 'engagement' : 'engagements'}, every allied formation returned. The promotion records the people you preserved as well as the ground you held.`
      : `${losses} allied ${losses === 1 ? 'formation withdrew' : 'formations withdrew'} during this chapter. The promotion records a victory with a cost; their veterans remain on the roll and receive time to recover.`;
  const praise = honoured.length ? ` Commendations name ${honoured.slice(0,3).join(', ')}${honoured.length > 3 ? ' and the other returning veterans' : ''}.` : '';
  const recovery = recovering.length ? ` ${recovering.map(veteran => veteran.name).join(', ')} need recovery. Each completed encounter reduces it by one step; without a fresh injury, full strength returns within two. No one is removed from your command.` : '';
  return conduct + praise + recovery;
}

export function provinceSummary(state) {
  if (!state.allocation) return [];
  const {river, farms, town} = state.allocation;
  const lines = [
    `River garrisons received ${river} ${river === 1 ? 'convoy' : 'convoys'}. The grain-road formations begin with ${(river - 1) * 5} additional morale.`,
    `Farming villages received ${farms} ${farms === 1 ? 'convoy' : 'convoys'}. Their guarded grain stores gain ${(farms - 1) * 5} integrity for the road defence.`,
    `Town granaries received ${town} ${town === 1 ? 'convoy' : 'convoys'}. ${town >= 3 ? 'Landholder delegates begin the governor’s tribunal one stance point more supportive.' : 'The town receives its guaranteed relief; no extra Landholder stance is granted.'}`,
  ];
  if (state.judgment) lines.push(state.judgment === 'shared'
    ? 'Shared tenure protects both communities. Civic delegates begin the tribunal one stance point more supportive; Aelia must explain to the settlers why neighbours keep their fields.'
    : 'Settler priority gives the displaced first title. Veteran delegates begin the tribunal one stance point more supportive, while Landholders begin one point less supportive; established tenants petition against the loss.');
  return lines;
}

export function cursusHonorum(state) {
  const completed = state?.completed ?? [], current = state?.chapter ?? 1, history = state?.history ?? [];
  return CHAPTERS.map(ch => {
    const isCompleted = completed.includes(ch.id), isCurrent = current === ch.id && !isCompleted;
    const status = isCompleted ? 'completed' : isCurrent ? 'current' : 'locked';
    const choiceId = state?.decisions?.[ch.decision?.id];
    const decision = ch.decision?.options?.find(o => o.id === choiceId)?.label ?? null;
    const records = history.filter(h => h.chapter === ch.id);
    const acclaimed = ch.id === 12 && state?.phase === 'epilogue';
    return {
      chapter: ch.id,
      title: ch.title,
      year: ch.year,
      location: ch.location,
      rank: acclaimed ? 'Augustus' : ch.rank,
      rankMeaning: acclaimed ? 'Acclaimed Emperor of Rome' : ch.rankMeaning,
      promotion: ch.promotion,
      capability: ch.capability,
      reward: ch.reward,
      status,
      decision,
      encountersWon: records.length,
      turns: records.reduce((n, r) => n + (r.turns || 0), 0),
    };
  });
}

