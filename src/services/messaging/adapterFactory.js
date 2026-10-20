const config = require('../../config');
const MetaWhatsAppAdapter = require('./metaAdapter');
const MockWhatsAppAdapter = require('./mockAdapter');

class AdapterFactory {
  static getAdapter() {
    const provider = config.whatsappProvider;
    if (provider === 'mock') {
      return new MockWhatsAppAdapter();
    }
    return new MetaWhatsAppAdapter();
  }
}

module.exports = AdapterFactory;
