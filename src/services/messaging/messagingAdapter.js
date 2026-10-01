class MessagingAdapter {
  parseInboundPayload(rawPayload) {
    throw new Error('Method parseInboundPayload() must be implemented.');
  }

  formatOutboundMessage(recipientId, messageText) {
    throw new Error('Method formatOutboundMessage() must be implemented.');
  }
}

module.exports = MessagingAdapter;
