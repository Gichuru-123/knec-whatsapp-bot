'use strict';

const { createInitialState, handleInput } = require('./navigation');
const { renderResponse } = require('./responseRenderer');

class ConversationService {
  constructor({ store, transition = handleInput, renderer = renderResponse } = {}) {
    if (!store || typeof store.applyEvent !== 'function' || typeof transition !== 'function' || typeof renderer !== 'function') {
      throw new Error('INVALID_CONVERSATION_SERVICE_CONFIGURATION');
    }
    this.store = store;
    this.transition = transition;
    this.renderer = renderer;
  }

  async process({ conversationId, eventId, accountSid, input } = {}) {
    const applied = await this.store.applyEvent(conversationId, eventId, accountSid, ({ state }) => {
      const result = this.transition(input, state || createInitialState());
      return { state: result.state, response: result.response, outboundBody: this.renderer(result.response) };
    });
    return {
      response: applied.response,
      duplicate: applied.duplicate,
      session: {
        revision: applied.revision,
        started: applied.started || false,
        restarted: applied.restarted || false
      }
    };
  }
}

module.exports = { ConversationService };
