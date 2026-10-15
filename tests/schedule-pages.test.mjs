import {readStyles} from './readStyles.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
const source = await readFile(new URL('../src/SchedulePages.tsx', import.meta.url), 'utf8');
const styles = await readStyles();

const ast = ts.createSourceFile('SchedulePages.tsx', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(ts.isVariableStatement)
  .flatMap(statement => Array.from(statement.declarationList.declarations));

function readLiteral(expression) {
  if (ts.isStringLiteral(expression)) return expression.text;
  if (ts.isNumericLiteral(expression)) return Number(expression.text);
  if (ts.isArrayLiteralExpression(expression)) return expression.elements.map(readLiteral);
  if (ts.isObjectLiteralExpression(expression)) {
    return Object.fromEntries(expression.properties.map(property => {
      assert.ok(ts.isPropertyAssignment(property));
      return [property.name.getText(ast), readLiteral(property.initializer)];
    }));
  }
  throw new Error('Unexpected fixture literal: ' + expression.getText(ast));
}

const declaration = declarations.find(node => node.name.getText(ast) === 'scheduleExamples');
assert.ok(declaration, 'scheduleExamples fixture must exist');
const fixtures = readLiteral(declaration.initializer);

// Pure calendar helpers are extracted from the same production source, avoiding duplicate model logic in tests.
const modelSource = source.slice(source.indexOf('const SLOT_MINUTES ='), source.indexOf('type HoveredSlot ='));
assert.ok(modelSource.startsWith('const SLOT_MINUTES ='));
const modelJs = ts.transpileModule(modelSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const model = await import('data:text/javascript;base64,' + Buffer.from(modelJs).toString('base64'));

test('four distinct demo schedules contain requested participant counts and date/time windows', () => {
  assert.equal(fixtures.length, 4);
  assert.deepEqual(fixtures.map(x => x.id), ['regular-a', 'regular-b', 'collab', 'free-jam']);
  assert.deepEqual(fixtures.map(x => x.title), [
    '정기공연 A팀 합주', '정기공연 B팀 합주', '연합공연 합주', '자율 합주',
  ]);
  assert.deepEqual(fixtures[0].participants, ['갑길동', '을길동', '병길동', '정길동']);
  assert.deepEqual(fixtures[1].participants, ['갑길동', '을길동', '병길동', '정길동', '무길동', '기길동', '경길동']);
  assert.deepEqual(fixtures.map(x => x.participants.length), [4, 7, 5, 3]);
  assert.deepEqual(
    fixtures.slice(0, 2).map(({ startDate, endDate, startTime, endTime }) => [startDate, endDate, startTime, endTime]),
    [
      ['2026-10-13', '2026-10-19', '00:00', '24:00'],
      ['2026-10-15', '2026-11-12', '09:00', '22:00'],
    ],
  );
  assert.ok(fixtures.every(x => x.participants.length >= 1));
  assert.ok(fixtures.every(x => (Number(x.endTime.slice(0, 2)) - Number(x.startTime.slice(0, 2))) > 0));
});

test('calendar generation uses inclusive, timezone-safe dates and 30-minute blocks', () => {
  assert.equal(model.getScheduleDates(fixtures[0].startDate, fixtures[0].endDate).length, 7);
  assert.equal(model.getScheduleDates(fixtures[1].startDate, fixtures[1].endDate).length, 29);
  assert.equal(model.getScheduleDates(fixtures[2].startDate, fixtures[2].endDate).length, 8);
  assert.equal(model.getScheduleSlots(fixtures[0].startTime, fixtures[0].endTime).length, 48);
  assert.equal(model.getScheduleSlots(fixtures[1].startTime, fixtures[1].endTime).length, 26);
  assert.deepEqual(model.getScheduleSlots('09:00', '10:30'), [540, 570, 600]);
  assert.deepEqual(model.getScheduleSlots('23:00', '24:00'), [1380, 1410]);
  assert.equal(model.getScheduleDates('2026-10-31', '2026-11-02').length, 3);
  assert.match(source, /const SLOT_MINUTES = 30;/);
  assert.match(source, /minutes % 60 === 0/);
  assert.match(source, /schedule-time-tick/);
  assert.match(source, /slotStart % 60 === 0 \? ' starts-hour'/);
  assert.match(styles, /\.schedule-time-tick\s*\{[^}]*position:\s*absolute;/s);
  assert.match(styles, /\.schedule-time-slot\.starts-hour\s*\{[^}]*border-top-color:\s*#fff;/s);
});

test('each available-person count maps to a different shade from white to dark green', () => {
  assert.equal(model.availabilityColor(0, 7), 'rgb(255, 255, 255)');
  const colors = Array.from({ length: 8 }, (_, i) => model.availabilityColor(i, 7));
  assert.equal(new Set(colors).size, 8);
  const extractRed = color => Number(color.match(/rgb\((\d+)/)[1]);
  assert.ok(colors.every((value, index) => index === 0 || extractRed(value) < extractRed(colors[index - 1])));
  assert.ok(model.exampleAvailability(0, 0, 0, 0), 'fixture should include all-available slots');
  assert.ok(!model.exampleAvailability(0, 0, 1, 0), 'fixture should include other outcomes');
  assert.match(source, /Array\.from\(\{ length: activeCount \+ 1 \}/);
  assert.match(source, /available = getAvailable\(dayIndex, slotIndex, activeNames\)\.length/);
});

test('landing remains compact and shows four schedule-opening actions only', () => {
  const landing = source.slice(source.indexOf('export function ScheduleLanding'), source.indexOf('const SLOT_MINUTES ='));
  assert.match(landing, /시간표 만들기/);
  assert.match(landing, /내가 참여한 시간표/);
  assert.match(landing, /scheduleExamples\.map\(schedule =>/);
  assert.match(landing, /onClick=\{\(\) => onOpen\(schedule\.id\)\}/);
  assert.match(landing, /예시 시간표 4개/);
  assert.doesNotMatch(landing, /schedule-timetable-scroll|schedule-time-slot/);
  assert.match(styles, /\.schedule-create-card\s*\{[^}]*min-height:\s*0;[^}]*padding:\s*21px 24px;/s);
  assert.match(styles, /\.schedule-list-section\s*\{\s*margin-top:\s*35px/);
});

test('landing shows exact planned-feature copy in a vertical three-item guide without enabling mutations', () => {
  const landing = source.slice(source.indexOf('export function ScheduleLanding'), source.indexOf('const SLOT_MINUTES ='));
  const guide = landing.slice(landing.indexOf('<aside className="container schedule-usage-guide"'), landing.indexOf('<section className="container section-block schedule-landing">'));
  assert.match(landing, /<ScheduleHeading title="합주 시간 조율"[^>]*\/>\s*<aside className="container schedule-usage-guide"/);
  assert.match(guide, /시간표 사용 안내/);
  assert.match(guide, /아래 기능은 추후 지원 예정입니다/);
  assert.equal((guide.match(/<li>/g) ?? []).length, 3);
  for (const message of [
    '학번으로 다른 부원을 시간표에 초대할 수 있습니다.',
    '운영진 권한이 있으면 구성팀 시간표를 개설해줄 수 있습니다.',
    '시간표에서 합주 시간을 확정할 수 있습니다. 합주 시간을 확정하면 본인의 다른 시간표에서는 해당 시간이 자동으로 선택 해제됩니다.',
  ]) assert.ok(guide.includes('<p>' + message + '</p>'), 'Guide text must be exact: ' + message);
  assert.doesNotMatch(guide, /onClick=|onSubmit=|onChange=/);
  assert.match(styles, /\.schedule-usage-list\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  assert.doesNotMatch(styles, /\.schedule-usage-list\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.match(styles, /\.schedule-usage-list li \+ li\s*\{[^}]*border-top:\s*1px solid #e0eae3;/s);
});

test('existing management-role gating and unimplemented creation buttons are preserved', () => {
  assert.match(source, /\{canCreateTeam && <button/);
  assert.match(app, /canCreateTeam=\{Boolean\(user && !authPending && currentLevel\)\}/);
  assert.match(app, /const currentLevel=managementLevel\(profile,hasSystemClaim\)/);
  assert.match(app, /profile\.role === 'part_leader' \|\| profile\.role === 'staff' \|\| profile\.role === 'president'/);
  assert.match(app, /onCreate=\{\(\) => notify\('시간표 만들기 기능은 추후 연결할 예정입니다\.'\)\}/);
  assert.match(app, /onCreateTeam=\{\(\) => notify\('구성팀 시간표 만들기 기능은 추후 연결할 예정입니다\.'\)\}/);
});

test('right-side panel supports all-vs-everyone filters and participant on/off controls', () => {
  assert.match(source, /type ViewMode = 'all' \| 'everyone'/);
  assert.match(source, /const \[selectedNames, setSelectedNames\] = useState<string\[\]>/);
  assert.match(source, /const \[mode, setMode\] = useState<ViewMode>\('all'\)/);
  assert.match(source, /activeCount > 0 && available === activeCount/);
  assert.match(source, /mode === 'all' \|\| allSelectedAvailable/);
  assert.match(source, /체크한 사람들의 가능 시간을 표시합니다/);
  assert.match(source, /모임 전체/);
  assert.match(source, /모두 되는 시간/);
  assert.match(source, /aria-pressed=\{mode === 'all'\}/);
  assert.match(source, /aria-pressed=\{mode === 'everyone'\}/);
  assert.match(source, /type="checkbox" checked=\{selectedNames\.includes\(name\)\}/);
  assert.match(source, /onChange=\{\(\) => togglePerson\(name\)\}/);
  assert.match(source, /모두 선택/);
  assert.match(source, /activeCount === 0/);
});

test('hover and keyboard focus replace controls with available/unavailable participant lists', () => {
  assert.match(source, /onMouseEnter=\{\(\) => setHoveredSlot\(\{ dayIndex, slotIndex \}\)\}/);
  assert.match(source, /onMouseLeave=\{\(\) => setHoveredSlot\(null\)\}/);
  assert.match(source, /onFocus=\{\(\) => setHoveredSlot\(\{ dayIndex, slotIndex \}\)\}/);
  assert.match(source, /onBlur=\{\(\) => setHoveredSlot\(null\)\}/);
  assert.match(source, /hoveredSlot && hoveredDate && hoveredTime !== undefined \?/);
  assert.match(source, /availableNames = hoveredSlot/);
  assert.match(source, /unavailableNames = schedule\.participants\.filter/);
  assert.match(source, /가능 \(\{availableNames\.length\}\)/);
  assert.match(source, /불가능 \(\{unavailableNames\.length\}\)/);
  assert.match(source, /전체 참여자 기준/);
  assert.match(styles, /\.schedule-detail-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 240px;/s);
});

test('long date ranges scroll horizontally and full-day hours flow vertically', () => {
  assert.match(source, /const columns = \`64px repeat\(\$\{dates\.length\}, 70px\)\`;/);
  assert.match(source, /width: 64 \+ dates\.length \* 70/);
  assert.doesNotMatch(source, /Math\.max\(720, 64 \+ dates\.length \* 86\)/);
  assert.match(styles, /\.schedule-timetable-scroll\s*\{[^}]*width:\s*max-content;[^}]*overflow-x:\s*auto;[^}]*max-width:\s*100%;/s);
  assert.match(styles, /\.schedule-detail-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 240px;/s);
  assert.match(source, /height: slots\.length \* SLOT_HEIGHT/);
  assert.match(source, /const SLOT_HEIGHT = 20;/);
  assert.match(source, /className="schedule-timetable-scroll"/);
  assert.match(styles, /\.schedule-timetable-scroll\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(styles, /\.schedule-day-slots\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
  assert.match(styles, /\.schedule-time-slot\s*\{[^}]*flex:\s*0 0 20px;[^}]*height:\s*20px;/s);
  assert.match(styles, /\.schedule-time-slot\s*\{[^}]*border-top:\s*1px solid #fff;[^}]*border-right:\s*1px solid #fff;/s);
  assert.match(styles, /\.schedule-time-slot:last-child\s*\{[^}]*border-bottom:\s*1px solid #fff;/s);
  assert.match(styles, /@media \(max-width:\s*740px\)\s*\{[\s\S]*?\.schedule-detail-layout\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\);/);
  assert.doesNotMatch(source, /setDoc\(|addDoc\(|updateDoc\(|fetch\(/);
});

test('schedule routing, titles, browser history and back button remain intact', () => {
  assert.match(app, /page === 'schedule-detail' \? '\/schedule'/);
  assert.match(app, /const scheduleIdFromPath =/);
  assert.match(app, /if \(scheduleIdFromPath\(\)\) return 'schedule-detail';/);
  assert.match(app, /setActiveScheduleId\(scheduleIdFromPath\(\)\)/);
  assert.match(app, /window\.history\.pushState\(null, '', path\)/);
  assert.match(app, /window\.addEventListener\('popstate',onPop\)/);
  assert.match(app, /page==='schedule-detail'&&<ScheduleDetail/);
  assert.match(source, /if \(!schedule\)/);
  assert.match(source, /onClick=\{onBack\}/);
  assert.match(source, /30분이며, 시간은 1시간 간격/);
});
