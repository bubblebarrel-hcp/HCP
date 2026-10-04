/* Milestone cards in the feed (D60): shows for a visible hasher who has not opted
   out, disappears when they opt out, and carries no engagement bar.
   Run: npx ts-node --transpile-only scripts/milestone-feed-check.ts */
import prisma from '../src/config/prisma';

const B = process.env.API ?? 'http://localhost:5010/api/v1';
let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}
async function call(method: string, path: string, token?: string, body?: unknown) {
  const res = await fetch(`${B}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return ((await res.json().catch(() => ({}))) as { data?: any }).data;
}

async function main() {
  const login = await call('POST', '/auth/login', undefined, { email: 'officer2@hcp.test', password: 'OnOn2026!' });
  const token = login.accessToken as string;
  const me = login.user.id as string;
  const passport = await prisma.hashPassport.findUniqueOrThrow({ where: { userId: me } });
  await prisma.passportMilestone.deleteMany({ where: { passportId: passport.id, threshold: 9999 } });
  const row = await prisma.passportMilestone.create({ data: { passportId: passport.id, threshold: 9999 } });

  const has = async () => {
    const feed = await call('GET', '/feed?limit=20');
    return (feed.items as any[]).find((i) => i.kind === 'MILESTONE' && i.id === row.id);
  };

  const card = await has();
  check('milestone card is in the feed', Boolean(card && card.threshold === 9999), card);
  check('it has no engagement to show', Boolean(card) && card.engagement.likes === 0);

  await call('PATCH', '/me/privacy', token, { shareMilestones: false });
  check('opting out removes the card', !(await has()));
  await call('PATCH', '/me/privacy', token, { shareMilestones: true });
  check('opting back in restores it', Boolean(await has()));

  await call('PATCH', '/me/privacy', token, { profileVisibility: 'ONLY_ME' });
  check('a closed profile has no card', !(await has()));
  await call('PATCH', '/me/privacy', token, { profileVisibility: 'PUBLIC' });

  await prisma.passportMilestone.delete({ where: { id: row.id } });
  console.log(failures ? `\n${failures} FAILED` : '\nAll passed');
  process.exit(failures ? 1 : 0);
}
main();
