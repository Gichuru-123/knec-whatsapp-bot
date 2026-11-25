'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialState, handleInput } = require('../../src/services/conversation/navigation');
const { MAX_RENDERED_LENGTH, renderResponse } = require('../../src/services/conversation/responseRenderer');

test('Phase 5: root renderer gives a polished, scannable service menu', () => {
  const response = handleInput('main menu', createInitialState()).response;
  const text = renderResponse(response);
  assert.match(text, /KNEC NURU — Main Menu/);
  assert.match(text, /\*1\.\* 📝 Examinations & Registration/);
  assert.doesNotMatch(text, /Assessment registration, examination series/);
  assert.match(text, /HELP • MAIN MENU/);
  assert.doesNotMatch(text, /Welcome!/);
  assert.ok(text.length <= MAX_RENDERED_LENGTH);
  assert.ok(text.length < 500);
});

test('NURU: first-time greeting is warm, concise and identifies a digital assistant', () => {
  const text = renderResponse(handleInput('Hi', createInitialState()).response);
  assert.ok(text.startsWith("👋 *Welcome! I'm NURU ✨, your KNEC digital assistant.*\n\nHow can I help you today?"));
  assert.match(text, /\*7\.\* 🏢 General Administration — Coming Soon/);
  assert.doesNotMatch(text, /KNEC NURU — Main Menu/);
  assert.ok(text.length < 500);
  assert.doesNotMatch(text, /\\/);
  assert.equal((text.match(/\*/g) || []).length % 2, 0);
});

test('Phase 5: nested menu includes location and context-aware commands', () => {
  const response = handleInput('1', createInitialState()).response;
  const text = renderResponse(response);
  assert.match(text, /📝 \*Examinations & Registration\*/);
  assert.match(text, /📍 Examinations & Registration/);
  assert.match(text, /\*1\.\* 🎓 KCSE Registration/);
  assert.match(text, /\*6\.\* 🛠️ Business & Technical Examinations/);
  assert.match(text, /BACK {2}• {2}MAIN MENU {2}• {2}HELP/);
  assert.doesNotMatch(text, /Welcome/);
});

test('Phase 5: invalid, fallback and placeholder responses preserve the menu', () => {
  const state = createInitialState();
  const invalid = handleInput('99', state);
  const fallback = handleInput('99', invalid.state);
  const placeholder = handleInput('7', state);
  assert.match(renderResponse(invalid.response), /OPTION NOT RECOGNISED/);
  assert.match(renderResponse(fallback.response), /MORE HELP NEEDED/);
  assert.match(renderResponse(placeholder.response), /General Administration — Coming Soon/);
  assert.match(renderResponse(placeholder.response), /🏢/);
  assert.doesNotMatch(renderResponse(placeholder.response), /KNEC NURU — Main Menu/);
});

test('Phase 5: knowledge hook renderer never publishes draft KB content', () => {
  const state = handleInput('2', createInitialState()).state;
  const response = handleInput('1', state).response;
  const text = renderResponse(response);
  assert.match(text, /SERVICE SELECTED/);
  assert.match(text, /🧭/);
  assert.doesNotMatch(text, /Phase 6|articleId|cert-replacement/);
});

test('NURU emoji system: deep TVET menus use consistent single-purpose icons', () => {
  let state = createInitialState();
  state = handleInput('1', state).state;
  let response = handleInput('6', state);
  let text = renderResponse(response.response);
  assert.match(text, /🛠️ \*Business & Technical Examinations\*/);
  assert.match(text, /\*2\.\* 📚 Business Examinations/);
  assert.match(text, /\*3\.\* 🧰 Technical Examinations/);
  assert.match(text, /\*4\.\* 🗓️ Examination Series/);

  state = response.state;
  response = handleInput('4', state);
  text = renderResponse(response.response);
  assert.match(text, /🗓️ \*Examination Series\*/);
  assert.match(text, /\*1\.\* 📅 November 2026/);
});
