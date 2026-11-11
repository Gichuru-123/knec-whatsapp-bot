'use strict';

const MAX_RENDERED_LENGTH = 1600;

function commandFooter(commands) {
  const available = [];
  if (commands?.back) available.push('BACK');
  if (commands?.mainMenu) available.push('MAIN MENU');
  if (commands?.help) available.push('HELP');
  return available.length ? `\n_${available.join('  •  ')}_` : '';
}

function renderMenu(menu, { welcome = false } = {}) {
  if (!menu || typeof menu.title !== 'string' || !Array.isArray(menu.options)) throw new Error('INVALID_MENU_RESPONSE');
  const lines = [];
  if (welcome) {
    lines.push('🏛️ *KNEC DIGITAL ASSISTANT*');
    lines.push('Welcome. Choose the service you need.');
  } else {
    lines.push(`*${menu.title}*`);
    if (Array.isArray(menu.breadcrumb) && menu.breadcrumb.length > 1) {
      lines.push(`📍 ${menu.breadcrumb.slice(1).join(' › ')}`);
    }
  }
  lines.push('');
  for (const option of menu.options) {
    lines.push(`*${option.number}.* ${option.title}`);
    if (option.description) lines.push(`   ${option.description}`);
  }
  lines.push('');
  lines.push('Reply with the option number.');
  return lines.join('\n') + commandFooter(menu.commands);
}

function renderResponse(response) {
  if (!response || typeof response.type !== 'string') throw new Error('INVALID_CONVERSATION_RESPONSE');
  let text;
  if (response.type === 'menu') {
    text = renderMenu(response.menu, { welcome: response.menu.nodeId === 'root' });
  } else if (response.type === 'help') {
    text = `ℹ️ *HELP*\n${response.message}\n\n${renderMenu(response.menu)}`;
  } else if (response.type === 'invalid' || response.type === 'fallback') {
    const heading = response.type === 'fallback' ? '⚠️ *MORE HELP NEEDED*' : '⚠️ *OPTION NOT RECOGNISED*';
    text = `${heading}\n${response.message}\n\n${renderMenu(response.menu)}`;
  } else if (response.type === 'placeholder') {
    text = `ℹ️ *SERVICE UPDATE*\n${response.message}\n\n${renderMenu(response.menu, { welcome: response.menu.nodeId === 'root' })}`;
  } else if (response.type === 'knowledge_lookup') {
    text = '✅ *SERVICE SELECTED*\nI am checking the approved guidance for this service.';
  } else {
    throw new Error('UNSUPPORTED_CONVERSATION_RESPONSE');
  }
  if (text.length > MAX_RENDERED_LENGTH) throw new Error('CONVERSATION_RESPONSE_TOO_LONG');
  return text;
}

module.exports = { MAX_RENDERED_LENGTH, renderMenu, renderResponse };
