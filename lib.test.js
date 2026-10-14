import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cotIndex, summarizeCot, parseRss, scoreNews, dedupe, similarity, eventWords } from './lib.js';

test('cotIndex', () => {
  assert.equal(cotIndex([0, 50, 100], 3), 100);
  assert.equal(cotIndex([100, 50, 0], 3), 0);
  assert.equal(cotIndex([0, 100, 50], 3), 50);
  assert.equal(cotIndex([5, 5, 5], 3), 50);
  assert.equal(cotIndex([1000, 0, 10, 5], 3), 50); // window ignores older values
});

test('summarizeCot: newest-first rows, nets and weekly change', () => {
  const row = (d, l, s) => ({ report_date_as_yyyy_mm_dd: `${d}T00:00:00.000`, open_interest_all: '1000', m_money_positions_long_all: l, m_money_positions_short_all: s });
  const s = summarizeCot([row('2026-09-29', '300', '100'), row('2026-09-22', '250', '100')]);
  assert.equal(s.date, '2026-09-29');
  assert.equal(s.last.mm, 200);
  assert.equal(s.change.mm, 50);
  assert.equal(s.pctOi.mm, 20);
  assert.equal(s.history[0].date, '2026-09-22');
});

test('parseRss handles CDATA, entities and Google News source suffix', () => {
  const xml = `<rss><channel><item><title><![CDATA[Gold &amp; silver rally - Reuters]]></title><link>https://x.test/a</link>
    <pubDate>Mon, 05 Oct 2026 10:00:00 GMT</pubDate><source url="https://reuters.com">Reuters</source></item></channel></rss>`;
  const [it] = parseRss(xml, 'Google News');
  assert.equal(it.title, 'Gold & silver rally');
  assert.equal(it.source, 'Reuters');
  assert.equal(it.time, Date.parse('2026-10-05T10:00:00Z'));
});

test('scoreNews ranks a fresh Fed/gold headline above stale stock chatter', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const a = scoreNews({ title: 'Gold jumps as Powell signals rate cut', summary: '', time: now - 36e5, feed: 'FXStreet' }, now);
  const b = scoreNews({ title: 'Stocks drift on Wall Street', summary: '', time: now - 20 * 36e5, feed: 'CNBC' }, now);
  assert.ok(a.score > b.score);
  assert.deepEqual(a.tags.slice(0, 2), ['Oro', 'Fed']);
  const boosted = scoreNews({ title: 'US CPI hotter than expected', summary: '', time: now, feed: 'CNBC' }, now, ['cpi']);
  assert.ok(boosted.tags.includes('Evento hoy'));
});

test('dedupe keeps the best story per cluster and records other sources', () => {
  assert.ok(similarity('Gold hits record high on Fed bets', 'Gold hits a record high on Fed rate bets') >= 0.6);
  const out = dedupe([
    { title: 'Gold hits record high on Fed bets', score: 5, source: 'CNBC' },
    { title: 'Gold hits a record high on Fed rate bets', score: 9, source: 'Kitco' },
    { title: 'Oil slides as OPEC weighs output', score: 3, source: 'CNBC' },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out[0].source, 'Kitco');
  assert.deepEqual(out[0].also, ['CNBC']);
});

test('eventWords picks today high-impact events only', () => {
  const now = Date.parse('2026-10-05T12:00:00Z');
  const w = eventWords([
    { title: 'CPI m/m', impact: 'High', date: '2026-10-05T12:30:00.000Z' },
    { title: 'Non-Farm Employment Change', impact: 'High', date: '2026-10-09T12:30:00.000Z' },
    { title: 'ISM Services PMI', impact: 'Medium', date: '2026-10-05T14:00:00.000Z' },
  ], now);
  assert.deepEqual(w, ['cpi']);
});
