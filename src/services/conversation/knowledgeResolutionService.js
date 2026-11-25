'use strict';

const kbService = require('../kbService');
const { MAX_INPUT_LENGTH, normalizeInput, validateState, handleInput } = require('./navigation');

const MAX_CLARIFICATION_ATTEMPTS = 2;
const KNEC_SWITCHBOARD_DISPLAY = '0719 093 000';
const FIELD_ORDER = ['examination', 'year', 'audience', 'programme', 'series'];
const FIELD_LABELS = Object.freeze({
  examination: 'examination', year: 'examination year', audience: 'user type',
  programme: 'programme', series: 'examination series'
});

function escalation(state, reason) {
  return {
    state: { ...structuredClone(state), workflow: null, invalidAttempts: 0 },
    response: {
      type: 'knowledge_escalation', reason, escalationRequired: true,
      message: `I cannot safely confirm this information from the currently approved guidance. ☎️ For clarification, call the KNEC switchboard on ${KNEC_SWITCHBOARD_DISPLAY}. This is a telephone contact; WhatsApp availability is not established.`
    }
  };
}

function clarification(state, workflow, requirements) {
  const field = workflow.pendingField;
  const requirement = requirements.fields.find(item => item.field === field);
  if (!requirement) return escalation(state, 'invalid_requirements');
  return {
    state: { ...structuredClone(state), workflow, invalidAttempts: 0 },
    response: {
      type: 'knowledge_clarification', field,
      message: requirement.question,
      options: requirement.allowedValues,
      commands: { back: true, mainMenu: true, help: true }
    }
  };
}

function nextMissingField(requirements, context) {
  return FIELD_ORDER.find(field => requirements.fields.some(item => item.field === field) && !context[field]) || null;
}

function normalizeAnswer(input, requirement) {
  const value = normalizeInput(input);
  if (!value || value.length > MAX_INPUT_LENGTH) return null;
  if (/^\d+$/.test(value)) {
    const index = Number(value) - 1;
    if (Number.isSafeInteger(index) && index >= 0 && index < requirement.allowedValues.length) {
      return requirement.allowedValues[index];
    }
  }
  const match = requirement.allowedValues.find(item => item.toLowerCase() === value);
  return match || null;
}

class KnowledgeResolutionService {
  constructor({ knowledge = kbService } = {}) {
    if (!knowledge || typeof knowledge.getApprovedAnswer !== 'function' ||
        typeof knowledge.getApprovedRequirements !== 'function') {
      throw new Error('INVALID_KNOWLEDGE_RESOLUTION_CONFIGURATION');
    }
    this.knowledge = knowledge;
  }

  transition(input, state) {
    validateState(state);
    const normalized = normalizeInput(input);
    if (['hi', 'hello', 'hey', 'start'].includes(normalized)) {
      return handleInput(normalized, { ...structuredClone(state), workflow: null });
    }
    if (state.workflow && ['back', 'previous'].includes(normalized)) {
      return handleInput('back', { ...structuredClone(state), workflow: null });
    }
    if (state.workflow && ['menu', 'main menu', 'main', 'home'].includes(normalized)) {
      return handleInput('main menu', { ...structuredClone(state), workflow: null });
    }
    if (state.workflow) return this.continueWorkflow(input, state);

    const navigation = handleInput(input, state);
    if (navigation.response.type !== 'knowledge_lookup') return navigation;
    return this.startWorkflow(navigation);
  }

  startWorkflow(navigation) {
    const { nodeId, articleId } = navigation.response;
    let requirements;
    try { requirements = this.knowledge.getApprovedRequirements(articleId); } catch { return escalation(navigation.state, 'resolution_failure'); }
    if (!requirements) return escalation(navigation.state, 'no_approved_answer');
    const context = { language: requirements.language };
    for (const item of requirements.fields) {
      if (item.allowedValues.length === 1 && item.allowedValues[0] === 'all') context[item.field] = 'all';
    }
    const pendingField = nextMissingField(requirements, context);
    const workflow = { version: 1, nodeId, articleId, pendingField, context, invalidAttempts: 0 };
    if (!pendingField) return this.resolve(navigation.state, workflow);
    return clarification(navigation.state, workflow, requirements);
  }

  continueWorkflow(input, state) {
    const workflow = structuredClone(state.workflow);
    let requirements;
    try { requirements = this.knowledge.getApprovedRequirements(workflow.articleId); } catch { return escalation(state, 'resolution_failure'); }
    if (!requirements) return escalation(state, 'approval_unavailable');
    if (normalizeInput(input) === 'help') return clarification(state, workflow, requirements);
    const requirement = requirements.fields.find(item => item.field === workflow.pendingField);
    if (!requirement) return escalation(state, 'invalid_pending_field');
    const value = normalizeAnswer(input, requirement);
    if (!value) {
      const attempts = workflow.invalidAttempts + 1;
      if (attempts >= MAX_CLARIFICATION_ATTEMPTS) return escalation(state, 'clarification_exhausted');
      workflow.invalidAttempts = attempts;
      const result = clarification(state, workflow, requirements);
      result.response.invalid = true;
      result.response.message = `That ${FIELD_LABELS[workflow.pendingField]} is not recognised. ${result.response.message}`;
      return result;
    }
    workflow.context[workflow.pendingField] = value;
    workflow.invalidAttempts = 0;
    workflow.pendingField = nextMissingField(requirements, workflow.context);
    if (workflow.pendingField) return clarification(state, workflow, requirements);
    return this.resolve(state, workflow);
  }

  resolve(state, workflow) {
    let answer;
    try { answer = this.knowledge.getApprovedAnswer(workflow.articleId, workflow.context); } catch { return escalation(state, 'resolution_failure'); }
    if (!answer) return escalation(state, 'not_eligible');
    return {
      state: { ...structuredClone(state), workflow: null, invalidAttempts: 0 },
      response: { type: 'knowledge_answer', answer }
    };
  }
}

module.exports = { KnowledgeResolutionService, MAX_CLARIFICATION_ATTEMPTS, KNEC_SWITCHBOARD_DISPLAY };
