'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialState, handleInput } = require('../../src/services/conversation/navigation');
const { MAX_RENDERED_LENGTH, renderResponse } = require('../../src/services/conversation/responseRenderer');

test('Phase 5: root renderer gives a polished, scannable service menu', () => {
  const response = handleInput('main menu', createInitialState()).response;
  const text = renderResponse(response);
  assert.match(text, /KNEC DIGITAL ASSISTANT/);
  assert.match(text, /\*1\.\* Registration/);
  assert.match(text, /Assessment registration, examination series/);
  assert.match(text, /MAIN MENU {2}• {2}HELP/);
  assert.ok(text.length <= MAX_RENDERED_LENGTH);
});

test('Phase 5: nested menu includes location and context-aware commands', () => {
  const response = handleInput('1', createInitialState()).response;
  const text = renderResponse(response);
  assert.match(text, /📍 Registration/);
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
  assert.match(renderResponse(placeholder.response), /SERVICE UPDATE/);
});

test('Phase 5: knowledge hook renderer never publishes draft KB content', () => {
  const state = handleInput('2', createInitialState()).state;
  const response = handleInput('1', state).response;
  const text = renderResponse(response);
  assert.match(text, /SERVICE SELECTED/);
  assert.doesNotMatch(text, /Phase 6|articleId|cert-replacement/);
});
