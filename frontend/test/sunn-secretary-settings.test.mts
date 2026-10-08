import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { secretarySettingsText } from '../src/app/admin/registrations/hq/sunn-secretary-settings-i18n.ts';
const source=readFileSync(new URL('../src/app/admin/registrations/hq/sunn-secretary-settings.tsx',import.meta.url),'utf8');
const page=readFileSync(new URL('../src/app/admin/registrations/hq/page.tsx',import.meta.url),'utf8');
for(const language of ['th','en','zh'] as const) test(`settings copy complete for ${language}`,()=>{
  const copy=secretarySettingsText[language];
  assert.deepEqual(Object.keys(copy).sort(),Object.keys(secretarySettingsText.en).sort());
  for(const text of Object.values(copy))assert.ok(text.trim());
  assert.notEqual(copy.forbidden,copy.missing);assert.notEqual(copy.configured,copy.validated);
});
test('settings remains on canonical self account card, no employee ID authorization',()=>{
  assert.match(page,/secretaryOwnerAllowed && actor\?\.id === account.id/u);
  assert.doesNotMatch(page,/account.employeeId === "6901011"/u);
});
test('secret inputs are masked, blank edits preserve values, errors are generic, and success clears edits',()=>{
  assert.match(source,/"password"/u);assert.match(source,/autoComplete="off"/u);
  assert.match(source,/setValues\(empty\(\)\)/u);assert.match(source,/response.ok/u);
  assert.match(source,/status === 401/u);assert.match(source,/status === 403/u);
  assert.match(source,/lock.current/u);assert.match(source,/90dvh/u);assert.match(source,/min-w-0/u);
  assert.doesNotMatch(source,/localStorage|sessionStorage|console\.|analytics/u);
  assert.match(source,/t.unknown/u);assert.match(source,/t.limited/u);
});
