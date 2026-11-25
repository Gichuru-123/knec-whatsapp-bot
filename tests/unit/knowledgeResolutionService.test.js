'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createInitialState, handleInput, validateState } = require('../../src/services/conversation/navigation');
const { KnowledgeResolutionService } = require('../../src/services/conversation/knowledgeResolutionService');
const { renderResponse } = require('../../src/services/conversation/responseRenderer');

function registrationState() {
  return handleInput('1', createInitialState()).state;
}

function syntheticKnowledge({ available = true } = {}) {
  const requirements = { articleId: 'reg-kcse', language: 'en', fields: [
    { field: 'examination', question: 'Which examination?', allowedValues: ['KCSE', 'KPSEA'] },
    { field: 'year', question: 'Which examination year?', allowedValues: ['2026', '2027'] },
    { field: 'audience', question: 'Which user type?', allowedValues: ['candidate', 'institution'] }
  ] };
  return {
    getApprovedRequirements(id) { return available && id === 'reg-kcse' ? structuredClone(requirements) : null; },
    getApprovedAnswer(id, context) {
      if (id !== 'reg-kcse' || context.examination !== 'KCSE' || context.year !== '2026' ||
          context.audience !== 'candidate' || context.language !== 'en') return null;
      return { id, title: 'Synthetic approved guidance', claims: [{ text: 'Synthetic answer only.', citations: [{
        title: 'Synthetic source', locator: 'Synthetic section', url: 'https://www.knec.ac.ke/synthetic-test'
      }] }] };
    }
  };
}

test('knowledge workflow asks one metadata-driven question at a time and returns a cited answer', () => {
  const service = new KnowledgeResolutionService({ knowledge: syntheticKnowledge() });
  let result = service.transition('1', registrationState());
  assert.equal(result.response.type, 'knowledge_clarification');
  assert.equal(result.state.workflow.pendingField, 'examination');
  result = service.transition('1', result.state);
  assert.equal(result.state.workflow.context.examination, 'KCSE');
  assert.equal(result.state.workflow.pendingField, 'year');
  result = service.transition('2026', result.state);
  assert.equal(result.state.workflow.pendingField, 'audience');
  result = service.transition('candidate', result.state);
  assert.equal(result.response.type, 'knowledge_answer');
  assert.equal(result.state.workflow, null);
  const rendered = renderResponse(result.response);
  assert.match(rendered, /Synthetic answer only/);
  assert.match(rendered, /Synthetic source/);
  assert.match(rendered, /https:\/\/www\.knec\.ac\.ke\/synthetic-test/);
});

test('real-style unavailable approval escalates without starting clarification', () => {
  const service = new KnowledgeResolutionService({ knowledge: syntheticKnowledge({ available: false }) });
  const result = service.transition('1', registrationState());
  assert.equal(result.response.type, 'knowledge_escalation');
  assert.equal(result.response.reason, 'no_approved_answer');
  assert.equal(result.state.workflow, null);
  assert.match(renderResponse(result.response), /0719 093 000/);
  assert.match(renderResponse(result.response), /telephone contact/i);
  assert.doesNotMatch(renderResponse(result.response), /WhatsApp is available/i);
});

test('clarification is bounded and ambiguous answers are not inferred', () => {
  const service = new KnowledgeResolutionService({ knowledge: syntheticKnowledge() });
  let result = service.transition('1', registrationState());
  result = service.transition('the secondary exam', result.state);
  assert.equal(result.response.type, 'knowledge_clarification');
  assert.equal(result.state.workflow.invalidAttempts, 1);
  result = service.transition('not sure', result.state);
  assert.equal(result.response.type, 'knowledge_escalation');
  assert.equal(result.response.reason, 'clarification_exhausted');
  assert.equal(result.state.workflow, null);
});

test('BACK and MAIN MENU clear workflow context and return to safe navigation levels', () => {
  const service = new KnowledgeResolutionService({ knowledge: syntheticKnowledge() });
  const pending = service.transition('1', registrationState()).state;
  const back = service.transition('BACK', pending);
  assert.equal(back.response.reason, 'back');
  assert.equal(back.state.currentNodeId, 'root');
  assert.equal(back.state.workflow, null);
  const main = service.transition('MAIN MENU', pending);
  assert.equal(main.state.currentNodeId, 'root');
  assert.equal(main.state.workflow, null);
});

test('greetings clear an active clarification workflow and return the full welcome', () => {
  const service = new KnowledgeResolutionService({ knowledge: syntheticKnowledge() });
  let state = handleInput('1', createInitialState()).state;
  state = service.transition('1', state).state;
  assert.ok(state.workflow);
  for (const greeting of ['Hi', 'Hello', 'Hey', 'Start', '  HI  ']) {
    const result = service.transition(greeting, state);
    assert.equal(result.response.reason, 'welcome');
    assert.equal(result.state.currentNodeId, 'root');
    assert.equal(result.state.workflow, null);
    assert.equal(result.state.invalidAttempts, 0);
  }
});

test('workflow state validation rejects arbitrary fields and unbounded counters', () => {
  const service = new KnowledgeResolutionService({ knowledge: syntheticKnowledge() });
  const pending = service.transition('1', registrationState()).state;
  validateState(pending);
  assert.throws(() => validateState({ ...pending, workflow: { ...pending.workflow, context: { secret: 'value' } } }),
    /knowledge context/);
  assert.throws(() => validateState({ ...pending, workflow: { ...pending.workflow, invalidAttempts: 2 } }),
    /knowledge workflow/);
  assert.throws(() => validateState({ ...pending, workflow: { ...pending.workflow, articleId: 'cert-replacement' } }),
    /knowledge workflow/);
});

test('safe knowledge dependency failures become controlled escalation', () => {
  const service = new KnowledgeResolutionService({ knowledge: {
    getApprovedRequirements() { throw new Error('private dependency detail'); },
    getApprovedAnswer() { throw new Error('not reached'); }
  } });
  const result = service.transition('1', registrationState());
  assert.equal(result.response.type, 'knowledge_escalation');
  assert.equal(result.response.reason, 'resolution_failure');
  assert.doesNotMatch(renderResponse(result.response), /private dependency detail/);
});
