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
    lines.push("👋 *Welcome! I'm NURU ✨, your KNEC digital assistant.*");
    lines.push('');
    lines.push('How can I help you today?');
  } else if (menu.nodeId === 'root') {
    lines.push('✨ *KNEC NURU — Main Menu*');
  } else {
    lines.push(`${menu.emoji ? `${menu.emoji} ` : ''}*${menu.title}*`);
    if (Array.isArray(menu.breadcrumb) && menu.breadcrumb.length > 1) {
      lines.push(`📍 ${menu.breadcrumb.slice(1).join(' › ')}`);
    }
  }
  lines.push('');
  for (const option of menu.options) {
    lines.push(`*${option.number}.* ${option.emoji ? `${option.emoji} ` : ''}${option.title}`);
    if (menu.nodeId !== 'root' && option.description) lines.push(`   ${option.description}`);
  }
  lines.push('');
  if (menu.nodeId === 'root') {
    lines.push('Reply with a number (1–7).');
    lines.push('');
    lines.push('HELP • MAIN MENU');
    return lines.join('\n');
  }
  lines.push('Reply with an option number.');
  return lines.join('\n') + commandFooter(menu.commands);
}

function renderResponse(response) {
  if (!response || typeof response.type !== 'string') throw new Error('INVALID_CONVERSATION_RESPONSE');
  let text;
  if (response.type === 'menu') {
    text = renderMenu(response.menu, { welcome: response.reason === 'welcome' });
  } else if (response.type === 'help') {
    text = `ℹ️ *HELP*\n${response.message}\n\n${renderMenu(response.menu)}`;
  } else if (response.type === 'invalid' || response.type === 'fallback') {
    const heading = response.type === 'fallback' ? '⚠️ *MORE HELP NEEDED*' : '⚠️ *OPTION NOT RECOGNISED*';
    text = `${heading}\n${response.message}\n\n${renderMenu(response.menu)}`;
  } else if (response.type === 'placeholder') {
    text = response.message;
  } else if (response.type === 'knowledge_lookup') {
    text = '🧭 *SERVICE SELECTED*\nI am checking the approved guidance for this service.';
  } else if (response.type === 'knowledge_clarification') {
    const options = Array.isArray(response.options) && response.options.length > 0
      ? `\n\n${response.options.map((value, index) => `*${index + 1}.* ${value}`).join('\n')}`
      : '';
    text = `❓ *ONE DETAIL NEEDED*\n${response.message}${options}` + commandFooter(response.commands);
  } else if (response.type === 'knowledge_escalation') {
    text = `⚠️ *FURTHER ASSISTANCE NEEDED*\n${response.message}\n\n_MAIN MENU  •  HELP_`;
  } else if (response.type === 'knowledge_answer') {
    const claims = response.answer.claims.map(claim => `• ${claim.text}`).join('\n');
    const citations = [];
    const seen = new Set();
    for (const claim of response.answer.claims) {
      for (const citation of claim.citations) {
        const key = `${citation.title}|${citation.url}|${citation.locator}`;
        if (!seen.has(key)) {
          seen.add(key);
          citations.push(`• ${citation.title} — ${citation.locator}\n  ${citation.url}`);
        }
      }
    }
    text = `✅ *${response.answer.title}*\n${claims}\n\n📚 *Sources*\n${citations.join('\n')}\n\n_BACK  •  MAIN MENU  •  HELP_`;
  } else {
    throw new Error('UNSUPPORTED_CONVERSATION_RESPONSE');
  }
  if (text.length > MAX_RENDERED_LENGTH) throw new Error('CONVERSATION_RESPONSE_TOO_LONG');
  return text;
}

module.exports = { MAX_RENDERED_LENGTH, renderMenu, renderResponse };
