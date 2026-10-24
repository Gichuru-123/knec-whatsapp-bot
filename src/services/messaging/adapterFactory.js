const config = require('../../config');
const MetaWhatsAppAdapter = require('./metaAdapter');
const MockWhatsAppAdapter = require('./mockAdapter');
const TwilioWhatsAppAdapter = require('./twilioAdapter');

class AdapterFactory {
  static getAdapter() {
    const provider = config.whatsappProvider;
    if (provider === 'mock') {
      return new MockWhatsAppAdapter();
    }
    if (provider === 'meta') return new MetaWhatsAppAdapter();
    if (provider === 'twilio') return new TwilioWhatsAppAdapter();
    throw new Error('Unsupported messaging provider.');
  }
}

module.exports = AdapterFactory;
