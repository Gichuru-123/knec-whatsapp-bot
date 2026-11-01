'use strict';
const { randomUUID } = require('node:crypto');
const { DIAGNOSTIC_REPLY } = require('./deliveryService');

class DeliveryWorker {
  constructor({ store, send, runId, participant, intervalMs = 1000 }) {
    this.store = store;
    this.send = send;
    this.runId = runId;
    this.participant = participant;
    this.intervalMs = intervalMs;
    this.owner = randomUUID();
    this.stopped = true;
    this.active = null;
  }

  async tick() {
    const claim = await this.store.claim(this.runId, this.owner);
    if (!claim || !await this.store.owns(claim)) return;
    let result;
    try {
      result = await this.send(this.participant, DIAGNOSTIC_REPLY);
    } catch { result = { kind: 'uncertain' }; }
    // If persistence fails, leave sending intact. Expired-lease recovery makes
    // it uncertain rather than treating the reply as eligible for another send.
    await this.store.finish(claim, result);
  }

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    const next = () => {
      if (this.stopped) return;
      this.active = this.tick().catch(() => {}).finally(() => {
        this.active = null;
        if (!this.stopped) this.timer = setTimeout(next, this.intervalMs);
      });
    };
    next();
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    if (this.active) await this.active;
  }
}

module.exports = { DeliveryWorker };
