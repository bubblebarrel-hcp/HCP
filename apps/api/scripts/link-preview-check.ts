/* Unit checks for link-preview.service: which addresses are public, how a link is
   found in words, how tags are read. Run: npx ts-node --transpile-only scripts/link-preview-check.ts */
import { firstUrl, isPublicAddress, parsePreview } from '../src/services/link-preview.service';

let failures = 0;
function check(name: string, ok: boolean, extra?: unknown) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(extra)}`}`);
  if (!ok) failures += 1;
}

for (const bad of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'ff02::1', 'not-an-ip']) {
  check(`refuses ${bad}`, !isPublicAddress(bad));
}
for (const good of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.32.0.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
  check(`allows ${good}`, isPublicAddress(good));
}

check('finds a link', firstUrl('see https://example.com/a?b=1#frag, ok') === 'https://example.com/a?b=1');
check('strips trailing punctuation', firstUrl('(https://example.com/x).') === 'https://example.com/x');
check('ignores no link', firstUrl('nothing here') === null);
check('ignores non-http', firstUrl('ftp://example.com file://x') === null);

const html = `<html><head><title>Fallback &amp; title</title>
<meta property="og:title" content="Trail &quot;report&quot;">
<meta name="description" content="A  nice
 run">
<meta property='og:image' content='/img/cover.jpg'>
<meta property="og:site_name" content="Hash"></head></html>`;
const p = parsePreview(html, 'https://example.com/post/1');
check('og title, entities decoded', p.title === 'Trail "report"', p);
check('description whitespace collapsed', p.description === 'A nice run', p);
check('relative image resolved', p.imageUrl === 'https://example.com/img/cover.jpg', p);
check('site name', p.siteName === 'Hash', p);
check('javascript: image dropped', parsePreview('<meta property="og:image" content="javascript:alert(1)">', 'https://e.com/').imageUrl === null);

process.exit(failures ? 1 : 0);
