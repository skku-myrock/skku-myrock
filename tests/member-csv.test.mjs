import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import typescript from 'typescript';

// Import the production TypeScript parser as transpiled JavaScript, with no
// Firebase/browser dependencies and without running a separate build first.
const source = await readFile(new URL('../src/memberCsv.ts', import.meta.url), 'utf8');
const compiled = typescript.transpileModule(source, {
  compilerOptions: {
    target: typescript.ScriptTarget.ES2022,
    module: typescript.ModuleKind.ESNext,
  },
}).outputText;
const { parseMembersCsv, splitMemberValues, formatMemberValues, exampleMemberCsvRows, serializeMembersCsv } =
  await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));

test('download sample contains exactly the requested member and remains importable', () => {
  const csv = serializeMembersCsv(exampleMemberCsvRows);
  assert.match(csv, /"학번","이름","기수","세션","직책"/);
  assert.match(csv, /"2026300001","홍길동","29","기타,베이스",""/);
  assert.deepEqual(parseMembersCsv(csv), [{
    studentId: '2026300001', name: '홍길동', generation: '29',
    sessions: ['기타', '베이스'], positions: [],
  }]);
});
test('comma variants with and without padding yield the same member data', () => {
  const header = '학번,이름,기수,세션,직책\n';
  const a = parseMembersCsv(header + '2026300001,홍길동,29,"기타,베이스","홍보부장,총무"');
  const b = parseMembersCsv(header + '2026300001,홍길동,29,"기타, 베이스","홍보부장, 총무"');
  assert.deepEqual(a, b);
  assert.deepEqual(a[0].sessions, ['기타', '베이스']);
  assert.deepEqual(a[0].positions, ['홍보부장', '총무']);
  assert.equal(formatMemberValues(a[0].sessions), '기타,베이스');
  assert.equal(formatMemberValues(a[0].positions), '홍보부장,총무');
});
test('delimiters remove padding, not meaningful internal whitespace', () => {
  assert.deepEqual(splitMemberValues(' 기타 , 베이스  '), ['기타','베이스']);
  assert.deepEqual(splitMemberValues(' 홍보 부장 , 총무 '), ['홍보 부장','총무']);
});
test('reject malformed unquoted commas instead of silently shifting columns', () => {
  assert.throws(
    () => parseMembersCsv('학번,이름,기수,세션,직책\n2026300001,홍길동,29,기타,베이스,'),
    /큰따옴표/,
  );
});
test('CRLF, quoted embedded line breaks, and escaped quote remain valid', () => {
  const csv = '\uFEFF학번,이름,기수,세션,직책\r\n2026300001,"홍길동",29,"기타, 베이스","홍보""부장, 총무"';
  assert.deepEqual(parseMembersCsv(csv)[0].positions, ['홍보"부장', '총무']);
  assert.deepEqual(parseMembersCsv(csv)[0].sessions, ['기타', '베이스']);
});
test('invalid session names and duplicate IDs remain rejected', () => {
  assert.throws(
    () => parseMembersCsv('학번,이름,기수,세션,직책\n2026300001,홍길동,29,"기타,피아노",'),
    /세션/,
  );
  assert.throws(
    () => parseMembersCsv('학번,이름,기수,세션,직책\n2026300001,홍길동,29,기타,\n2026300001,다른이름,29,드럼,'),
    /중복/,
  );
});
