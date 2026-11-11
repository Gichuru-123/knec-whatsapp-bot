'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ConversationService } = require('../../src/services/conversation/conversationService');
const { createInitialState } = require('../../src/services/conversation/navigation');

const ID = 'v1:' + 'b'.repeat(64);
const EVENT = 'd'.repeat(64);
const ACCOUNT = 'AC' + '1'.repeat(32);

test('Phase 5: service starts a new session and saves before returning', async () => {
  const calls = [];
  const store = {
    async applyEvent(id, eventId, accountSid, operation) {
      calls.push(['apply', id, eventId, accountSid]);
      const outcome = operation({ state: null, started: true, restarted: false });
      calls.push(['state', outcome.state.currentNodeId]);
      return { ...outcome, duplicate: false, revision: 1, started: true, restarted: false };
    }
  };
  const result = await new ConversationService({ store }).process({ conversationId: ID, eventId: EVENT, accountSid: ACCOUNT, input: '1' });
  assert.equal(result.response.type, 'menu');
  assert.equal(result.duplicate, false);
  assert.deepEqual(result.session, { revision: 1, started: true, restarted: false });
  assert.deepEqual(calls, [['apply', ID, EVENT, ACCOUNT], ['state', 'registration']]);
});

test('Phase 5: service resumes current state with its exact revision', async () => {
  const state = { ...createInitialState(), currentNodeId: 'registration', path: ['root', 'registration'] };
  const store = {
    async applyEvent(id, eventId, accountSid, operation) {
      const outcome = operation({ state, started: false, restarted: false });
      assert.equal(outcome.state.currentNodeId, 'registration.business-technical');
      return { ...outcome, duplicate: false, revision: 8, started: false, restarted: false };
    }
  };
  const result = await new ConversationService({ store }).process({ conversationId: ID, eventId: EVENT, accountSid: ACCOUNT, input: '6' });
  assert.deepEqual(result.session, { revision: 8, started: false, restarted: false });
});

test('Phase 5: expired session restarts only through explicit root reset', async () => {
  const store = {
    async applyEvent(id, eventId, accountSid, operation) {
      const outcome = operation({ state: null, started: false, restarted: true });
      assert.equal(outcome.state.currentNodeId, 'certificates');
      return { ...outcome, duplicate: false, revision: 5, started: false, restarted: true };
    }
  };
  const result = await new ConversationService({ store }).process({ conversationId: ID, eventId: EVENT, accountSid: ACCOUNT, input: '2' });
  assert.deepEqual(result.session, { revision: 5, started: false, restarted: true });
});

test('Phase 5: duplicate event returns stored response without reinterpreting input', async () => {
  let transitions = 0;
  const store = {
    async applyEvent() { return { duplicate: true, response: { type: 'menu', reason: 'stored' }, revision: 2 }; }
  };
  const service = new ConversationService({ store, transition(input, state) {
    transitions += 1;
    return { state, response: { type: 'menu' } };
  } });
  const result = await service.process({ conversationId: ID, eventId: EVENT, accountSid: ACCOUNT, input: '1' });
  assert.equal(result.duplicate, true);
  assert.equal(result.response.reason, 'stored');
  assert.equal(transitions, 0);
});
