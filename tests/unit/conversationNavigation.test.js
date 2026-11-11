'use strict';

const assert = require('assert');
const test = require('node:test');

const { MENU_TREE } = require('../../src/services/conversation/config/menuTree');
const {
  buildMenuIndex
} = require('../../src/services/conversation/config/menuIndex');

const {
  STATE_VERSION,
  MAX_INPUT_LENGTH,
  createInitialState,
  normalizeInput,
  validateState,
  renderMenu,
  handleInput
} = require('../../src/services/conversation/navigation');

test('Phase 5: menu tree validates and contains 44 nodes', () => {
  const index = buildMenuIndex(MENU_TREE);

  assert.strictEqual(index.rootId, 'root');
  assert.strictEqual(index.size(), 44);
});

test('Phase 5: initial state starts safely at root', () => {
  const state = createInitialState();

  assert.deepStrictEqual(state, {
    version: STATE_VERSION,
    currentNodeId: 'root',
    path: ['root'],
    invalidAttempts: 0
  });
});

test('Phase 5: root menu exposes seven top-level options', () => {
  const menu = renderMenu(MENU_TREE);

  assert.strictEqual(menu.nodeId, 'root');
  assert.strictEqual(menu.options.length, 7);
  assert.strictEqual(menu.commands.back, false);
  assert.strictEqual(menu.commands.mainMenu, true);
  assert.strictEqual(menu.commands.help, true);
});

test('Phase 5: supports arbitrary-depth parent-child navigation', () => {
  let state = createInitialState();

  let result = handleInput('1', state);
  assert.strictEqual(result.state.currentNodeId, 'registration');
  assert.strictEqual(result.response.menu.title, 'Registration');

  state = result.state;

  result = handleInput('6', state);
  assert.strictEqual(
    result.state.currentNodeId,
    'registration.business-technical'
  );
  assert.strictEqual(
    result.response.menu.title,
    'Business & Technical Examinations'
  );

  state = result.state;

  result = handleInput('2', state);
  assert.strictEqual(
    result.state.currentNodeId,
    'registration.business-technical.business'
  );
  assert.strictEqual(
    result.response.menu.title,
    'Business Examinations'
  );
});

test('Phase 5: deep leaf emits knowledge hook without serving KB answer', () => {
  let state = createInitialState();

  state = handleInput('1', state).state;
  state = handleInput('6', state).state;
  state = handleInput('2', state).state;

  const result = handleInput('2', state);

  assert.strictEqual(result.response.type, 'knowledge_lookup');
  assert.strictEqual(
    result.response.articleId,
    'tvet-business-stage-ii'
  );

  assert.strictEqual(
    result.state.currentNodeId,
    'registration.business-technical.business'
  );

  assert.match(
    result.response.message,
    /Phase 6/
  );
});

test('Phase 5: knowledge hook does not mutate navigation path', () => {
  let state = createInitialState();

  state = handleInput('1', state).state;

  const before = [...state.path];
  const result = handleInput('1', state);

  assert.strictEqual(result.response.type, 'knowledge_lookup');
  assert.deepStrictEqual(result.state.path, before);
});

test('Phase 5: BACK returns to immediate parent', () => {
  let state = createInitialState();

  state = handleInput('1', state).state;
  state = handleInput('6', state).state;

  const result = handleInput('back', state);

  assert.strictEqual(
    result.state.currentNodeId,
    'registration'
  );

  assert.strictEqual(
    result.response.reason,
    'back'
  );
});

test('Phase 5: BACK at root remains safely at root', () => {
  const result = handleInput(
    'back',
    createInitialState()
  );

  assert.strictEqual(result.state.currentNodeId, 'root');
  assert.strictEqual(
    result.response.reason,
    'already_at_root'
  );
});

test('Phase 5: MAIN MENU resets a deep conversation', () => {
  let state = createInitialState();

  state = handleInput('1', state).state;
  state = handleInput('6', state).state;
  state = handleInput('2', state).state;

  const result = handleInput('main menu', state);

  assert.deepStrictEqual(
    result.state.path,
    ['root']
  );

  assert.strictEqual(
    result.state.currentNodeId,
    'root'
  );
});

test('Phase 5: HOME alias returns to main menu', () => {
  let state = createInitialState();

  state = handleInput('1', state).state;

  const result = handleInput('home', state);

  assert.strictEqual(result.state.currentNodeId, 'root');
});

test('Phase 5: HELP works without changing current menu', () => {
  let state = createInitialState();

  state = handleInput('1', state).state;

  const result = handleInput('help', state);

  assert.strictEqual(result.response.type, 'help');
  assert.strictEqual(
    result.state.currentNodeId,
    'registration'
  );

  assert.strictEqual(
    result.response.menu.nodeId,
    'registration'
  );
});

test('Phase 5: first invalid input allows one retry', () => {
  const result = handleInput(
    '99',
    createInitialState()
  );

  assert.strictEqual(result.response.type, 'invalid');
  assert.strictEqual(result.response.retryAllowed, true);
  assert.strictEqual(result.state.invalidAttempts, 1);
});

test('Phase 5: second invalid input triggers safe fallback hook', () => {
  let state = createInitialState();

  state = handleInput('99', state).state;
  const result = handleInput('99', state);

  assert.strictEqual(result.response.type, 'fallback');
  assert.strictEqual(result.response.retryAllowed, false);
  assert.strictEqual(
    result.response.escalationRequired,
    true
  );

  assert.strictEqual(result.state.invalidAttempts, 0);
});

test('Phase 5: valid input resets invalid-attempt counter', () => {
  let state = createInitialState();

  state = handleInput('99', state).state;

  const result = handleInput('1', state);

  assert.strictEqual(result.state.invalidAttempts, 0);
  assert.strictEqual(
    result.state.currentNodeId,
    'registration'
  );
});

test('Phase 5: empty input is handled safely', () => {
  const result = handleInput(
    '',
    createInitialState()
  );

  assert.strictEqual(result.response.type, 'invalid');
});

test('Phase 5: non-string input is handled safely', () => {
  const result = handleInput(
    null,
    createInitialState()
  );

  assert.strictEqual(result.response.type, 'invalid');
});

test('Phase 5: oversized input is rejected safely', () => {
  const oversized = 'x'.repeat(MAX_INPUT_LENGTH + 1);

  const result = handleInput(
    oversized,
    createInitialState()
  );

  assert.strictEqual(result.response.type, 'invalid');
});

test('Phase 5: input normalization is deterministic', () => {
  assert.strictEqual(
    normalizeInput('  MAIN    MENU  '),
    'main menu'
  );

  assert.strictEqual(
    normalizeInput('  Help '),
    'help'
  );
});

test('Phase 5: exact menu title may be used as selection', () => {
  const result = handleInput(
    'Registration',
    createInitialState()
  );

  assert.strictEqual(
    result.state.currentNodeId,
    'registration'
  );
});

test('Phase 5: GA is a controlled placeholder only', () => {
  const result = handleInput(
    '7',
    createInitialState()
  );

  assert.strictEqual(result.response.type, 'placeholder');

  assert.strictEqual(
    result.response.nodeId,
    'general-administration'
  );

  assert.match(
    result.response.message,
    /planned for a future phase/i
  );

  assert.strictEqual(result.response.returnTo, 'root');
  assert.strictEqual(result.state.currentNodeId, 'root');

  assert.deepStrictEqual(
    result.state.path,
    ['root']
  );
});

test('Phase 5: corrupt state with unknown node is rejected', () => {
  const state = {
    version: STATE_VERSION,
    currentNodeId: 'does-not-exist',
    path: ['root', 'does-not-exist'],
    invalidAttempts: 0
  };

  assert.throws(
    () => validateState(state),
    /unknown menu node/
  );
});

test('Phase 5: corrupt state with invalid parent-child path is rejected', () => {
  const state = {
    version: STATE_VERSION,
    currentNodeId: 'verification',
    path: ['root', 'registration', 'verification'],
    invalidAttempts: 0
  };

  assert.throws(
    () => validateState(state),
    /invalid parent-child relationship/
  );
});

test('Phase 5: state cannot terminate on a knowledge-hook node', () => {
  const state = {
    version: STATE_VERSION,
    currentNodeId: 'registration.kcse',
    path: ['root', 'registration', 'registration.kcse'],
    invalidAttempts: 0
  };

  assert.throws(
    () => validateState(state),
    /current node must reference a menu node/
  );
});

test('Phase 5: unsupported state version is rejected', () => {
  const state = {
    version: 999,
    currentNodeId: 'root',
    path: ['root'],
    invalidAttempts: 0
  };

  assert.throws(
    () => validateState(state),
    /Unsupported conversation state version/
  );
});

test('Phase 5: menu index identifies deep parent correctly', () => {
  const index = buildMenuIndex(MENU_TREE);

  const parent = index.getParent(
    'registration.business-technical.business.stage-ii'
  );

  assert.ok(parent);

  assert.strictEqual(
    parent.id,
    'registration.business-technical.business'
  );
});

test('Phase 5: duplicate node IDs are rejected by configuration validator', () => {
  const badTree = {
    id: 'root',
    type: 'menu',
    title: 'Root',
    children: [
      {
        id: 'duplicate',
        type: 'placeholder',
        title: 'One',
        message: 'One',
        returnTo: 'root'
      },
      {
        id: 'duplicate',
        type: 'placeholder',
        title: 'Two',
        message: 'Two',
        returnTo: 'root'
      }
    ]
  };

  assert.throws(
    () => buildMenuIndex(badTree),
    /Duplicate menu node id/
  );
});

test('Phase 5: broken placeholder target is rejected', () => {
  const badTree = {
    id: 'root',
    type: 'menu',
    title: 'Root',
    children: [
      {
        id: 'placeholder',
        type: 'placeholder',
        title: 'Placeholder',
        message: 'Coming soon',
        returnTo: 'missing-node'
      }
    ]
  };

  assert.throws(
    () => buildMenuIndex(badTree),
    /returnTo target does not exist/
  );
});

test('Phase 5: menu node without children is rejected', () => {
  const badTree = {
    id: 'root',
    type: 'menu',
    title: 'Root',
    children: [
      {
        id: 'empty-menu',
        type: 'menu',
        title: 'Empty Menu',
        children: []
      }
    ]
  };

  assert.throws(
    () => buildMenuIndex(badTree),
    /must contain children/
  );
});