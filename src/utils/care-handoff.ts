import type { AppSettings, BabyProfile, FeedingLog, NursingSession } from './storage';

export function feedingDayTotals(logs: readonly FeedingLog[], now: number) {
  const day = new Date(now).toDateString();
  let bottles = 0, bottleMl = 0, nursingSeconds = 0, solids = 0;
  for (const log of logs) {
    if (new Date(log.timestamp).toDateString() !== day) continue;
    if (log.type === 'bottle' && log.details.bottle) {
      bottles++;
      bottleMl += log.details.bottle.amount;
    } else if (log.type === 'solid') {
      solids++;
    } else if (log.type === 'breast' && log.details.breast) {
      nursingSeconds += log.details.breast.leftDuration + log.details.breast.rightDuration;
    }
  }
  return { bottles, bottleMl, nursingSeconds, solids };
}

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? [minutes ? `${minutes} min` : '', `${rest} sec`].filter(Boolean).join(' ') : `${minutes} min`;
}

export function buildCareHandoff(baby: Pick<BabyProfile, 'id' | 'name'>, logs: readonly FeedingLog[],
  session: NursingSession | null, unit: AppSettings['volumeUnit'], now: number) {
  const feeds = logs.filter(log => log.babyId === baby.id && Date.parse(log.timestamp) <= now)
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const totals = feedingDayTotals(feeds, now);
  const volume = (ml: number) => unit === 'oz' ? `${(ml * 0.033814).toFixed(1)} oz` : `${ml} ml`;
  const formatDate: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  const date = new Intl.DateTimeFormat(undefined, formatDate);
  const at = new Intl.DateTimeFormat(undefined, { ...formatDate, timeZoneName: 'short' });
  const recent = feeds.slice(0, 3).map(log => {
    const { bottle, breast, solid } = log.details;
    let description;
    if (log.type === 'bottle') {
      description = bottle ? `Bottle · ${volume(bottle.amount)} · ${bottle.bottleType === 'breastmilk' ? 'Breast milk' : 'Formula'}` : 'Bottle';
    } else if (log.type === 'breast') {
      description = breast ? `Nursing · L ${duration(breast.leftDuration)} · R ${duration(breast.rightDuration)}` : 'Nursing';
    } else {
      description = solid?.foodDescription ? `Solids · ${solid.foodDescription}` : 'Solids';
    }
    return `${date.format(new Date(log.timestamp))} · ${description}`;
  });
  const timer = session?.babyId === baby.id
    ? `Nursing timer · ${session.runningSince === null ? 'Paused' : 'Running'} · ${session.side === 'left' ? 'Left' : 'Right'} side`
    : null;
  const title = `Care handoff for ${baby.name}`;
  const asOf = `As of ${at.format(new Date(now))}`;
  const today = [
    `${totals.bottles} ${totals.bottles === 1 ? 'bottle' : 'bottles'} · ${volume(totals.bottleMl)}`,
    `Nursing · ${duration(totals.nursingSeconds)}`,
    `${totals.solids} solid ${totals.solids === 1 ? 'feed' : 'feeds'}`,
  ];
  const latest = recent.length ? recent : ['No feeds recorded yet.'];
  const sections = [
    { heading: 'Today', lines: today },
    ...(timer ? [{ heading: 'In progress', lines: [timer] }] : []),
    { heading: 'Recent feeds · newest first', lines: latest },
  ];
  const message = [title + '\n' + asOf, ...sections.map(s => [s.heading, ...s.lines].join('\n'))].join('\n\n');
  return { title, asOf, sections, message };
}
