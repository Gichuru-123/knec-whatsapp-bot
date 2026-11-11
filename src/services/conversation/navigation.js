'use strict';

const { MENU_TREE } = require('./config/menuTree');
const { buildMenuIndex } = require('./config/menuIndex');

const MENU_INDEX = buildMenuIndex(MENU_TREE);

const STATE_VERSION = 1;
const MAX_INPUT_LENGTH = 200;
const MAX_INVALID_ATTEMPTS = 2;

const COMMANDS = Object.freeze({
  MAIN_MENU: 'main_menu',
  BACK: 'back',
  HELP: 'help'
});

const COMMAND_ALIASES = Object.freeze({
  menu: COMMANDS.MAIN_MENU,
  'main menu': COMMANDS.MAIN_MENU,
  main: COMMANDS.MAIN_MENU,
  home: COMMANDS.MAIN_MENU,

  back: COMMANDS.BACK,
  previous: COMMANDS.BACK,

  help: COMMANDS.HELP
});

function createInitialState() {
  return {
    version: STATE_VERSION,
    currentNodeId: MENU_INDEX.rootId,
    path: [MENU_INDEX.rootId],
    invalidAttempts: 0
  };
}

function normalizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }

  return input.trim().replace(/\s+/g, ' ').toLowerCase();
}

function validateState(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('Conversation state must be an object.');
  }

  if (state.version !== STATE_VERSION) {
    throw new Error('Unsupported conversation state version.');
  }

  if (
    typeof state.currentNodeId !== 'string' ||
    !MENU_INDEX.has(state.currentNodeId)
  ) {
    throw new Error('Conversation state references an unknown menu node.');
  }

  if (!Array.isArray(state.path) || state.path.length === 0) {
    throw new Error('Conversation state requires a non-empty path.');
  }

  if (state.path[0] !== MENU_INDEX.rootId) {
    throw new Error('Conversation path must begin at the root node.');
  }

  if (state.path[state.path.length - 1] !== state.currentNodeId) {
    throw new Error(
      'Conversation path must end at the current menu node.'
    );
  }

  for (const nodeId of state.path) {
    if (typeof nodeId !== 'string' || !MENU_INDEX.has(nodeId)) {
      throw new Error(
        'Conversation path contains an unknown menu node.'
      );
    }
  }

  for (let i = 1; i < state.path.length; i += 1) {
    const expectedParent = MENU_INDEX.getParent(state.path[i]);

    if (!expectedParent || expectedParent.id !== state.path[i - 1]) {
      throw new Error(
        'Conversation path contains an invalid parent-child relationship.'
      );
    }
  }

  const currentNode = MENU_INDEX.get(state.currentNodeId);

  if (!currentNode || currentNode.type !== 'menu') {
    throw new Error(
      'Conversation current node must reference a menu node.'
    );
  }

  if (
    !Number.isInteger(state.invalidAttempts) ||
    state.invalidAttempts < 0 ||
    state.invalidAttempts >= MAX_INVALID_ATTEMPTS
  ) {
    throw new Error('Conversation invalid-attempt counter is invalid.');
  }

  return state;
}

function cloneState(state) {
  return {
    version: state.version,
    currentNodeId: state.currentNodeId,
    path: [...state.path],
    invalidAttempts: state.invalidAttempts
  };
}

function renderMenu(node) {
  if (!node || node.type !== 'menu') {
    throw new Error('Only menu nodes can be rendered as menus.');
  }

  return {
    nodeId: node.id,
    title: node.title,
    breadcrumb: buildPathToNode(node.id).map((nodeId) => MENU_INDEX.get(nodeId).title),
    options: node.children.map((child, index) => ({
      number: index + 1,
      nodeId: child.id,
      title: child.title,
      ...(child.description ? { description: child.description } : {}),
      type: child.type
    })),
    commands: {
      back: node.id !== MENU_INDEX.rootId,
      mainMenu: true,
      help: true
    }
  };
}

function getHelpResponse(state) {
  const node = MENU_INDEX.get(state.currentNodeId);

  return {
    type: 'help',
    message:
      'Choose one of the numbered options. You can also use BACK, MAIN MENU, or HELP.',
    menu: renderMenu(node)
  };
}

function resetToMainMenu() {
  const state = createInitialState();

  return {
    state,
    response: {
      type: 'menu',
      reason: 'main_menu',
      menu: renderMenu(MENU_INDEX.get(MENU_INDEX.rootId))
    }
  };
}

function goBack(state) {
  if (state.currentNodeId === MENU_INDEX.rootId) {
    return {
      state: {
        ...cloneState(state),
        invalidAttempts: 0
      },
      response: {
        type: 'menu',
        reason: 'already_at_root',
        menu: renderMenu(MENU_INDEX.get(MENU_INDEX.rootId))
      }
    };
  }

  const nextPath = state.path.slice(0, -1);
  const nextNodeId = nextPath[nextPath.length - 1];
  const nextNode = MENU_INDEX.get(nextNodeId);

  return {
    state: {
      version: STATE_VERSION,
      currentNodeId: nextNodeId,
      path: nextPath,
      invalidAttempts: 0
    },
    response: {
      type: 'menu',
      reason: 'back',
      menu: renderMenu(nextNode)
    }
  };
}

function resolveSelection(node, normalizedInput) {
  if (!node || node.type !== 'menu') {
    return null;
  }

  if (/^\d+$/.test(normalizedInput)) {
    const selectionNumber = Number(normalizedInput);

    if (
      Number.isSafeInteger(selectionNumber) &&
      selectionNumber >= 1 &&
      selectionNumber <= node.children.length
    ) {
      return node.children[selectionNumber - 1];
    }

    return null;
  }

  return (
    node.children.find(
      (child) => child.title.trim().toLowerCase() === normalizedInput
    ) || null
  );
}

function handleMenuNode(state, selectedNode) {
  const nextState = {
    version: STATE_VERSION,
    currentNodeId: selectedNode.id,
    path: [...state.path, selectedNode.id],
    invalidAttempts: 0
  };

  return {
    state: nextState,
    response: {
      type: 'menu',
      reason: 'selection',
      menu: renderMenu(selectedNode)
    }
  };
}

function handleKnowledgeHook(state, selectedNode) {
  return {
    state: {
      ...cloneState(state),
      invalidAttempts: 0
    },
    response: {
      type: 'knowledge_lookup',
      nodeId: selectedNode.id,
      articleId: selectedNode.action.articleId,
      message:
        'Knowledge lookup is reserved for Phase 6 integration.'
    }
  };
}

function buildPathToNode(nodeId) {
  if (!MENU_INDEX.has(nodeId)) {
    throw new Error('Cannot build path to unknown node: ' + nodeId);
  }

  const reversedPath = [];
  let currentNode = MENU_INDEX.get(nodeId);

  while (currentNode) {
    reversedPath.push(currentNode.id);
    currentNode = MENU_INDEX.getParent(currentNode.id);
  }

  return reversedPath.reverse();
}

function handlePlaceholder(selectedNode) {
  const returnNode = MENU_INDEX.get(selectedNode.returnTo);

  if (!returnNode || returnNode.type !== 'menu') {
    throw new Error(
      'Placeholder return target must reference a menu node.'
    );
  }

  return {
    state: {
      version: STATE_VERSION,
      currentNodeId: returnNode.id,
      path: buildPathToNode(returnNode.id),
      invalidAttempts: 0
    },
    response: {
      type: 'placeholder',
      nodeId: selectedNode.id,
      message: selectedNode.message,
      returnTo: returnNode.id,
      menu: renderMenu(returnNode)
    }
  };
}

function handleInvalidInput(state) {
  const nextAttempt = state.invalidAttempts + 1;
  const currentNode = MENU_INDEX.get(state.currentNodeId);

  if (nextAttempt < MAX_INVALID_ATTEMPTS) {
    return {
      state: {
        ...cloneState(state),
        invalidAttempts: nextAttempt
      },
      response: {
        type: 'invalid',
        retryAllowed: true,
        message:
          'That selection is not available. Please choose one of the listed options.',
        menu: renderMenu(currentNode)
      }
    };
  }

  return {
    state: {
      ...cloneState(state),
      invalidAttempts: 0
    },
    response: {
      type: 'fallback',
      retryAllowed: false,
      escalationRequired: true,
      message:
        'I could not match that selection. Please choose a listed option, return to the main menu, or request help.',
      menu: renderMenu(currentNode)
    }
  };
}

function handleInput(input, state = createInitialState()) {
  validateState(state);

  const normalizedInput = normalizeInput(input);

  if (normalizedInput.length > MAX_INPUT_LENGTH) {
    return handleInvalidInput(state);
  }

  if (normalizedInput === '') {
    return handleInvalidInput(state);
  }

  const command = Object.prototype.hasOwnProperty.call(COMMAND_ALIASES, normalizedInput)
    ? COMMAND_ALIASES[normalizedInput]
    : null;

  if (command === COMMANDS.MAIN_MENU) {
    return resetToMainMenu();
  }

  if (command === COMMANDS.BACK) {
    return goBack(state);
  }

  if (command === COMMANDS.HELP) {
    return {
      state: {
        ...cloneState(state),
        invalidAttempts: 0
      },
      response: getHelpResponse(state)
    };
  }

  const currentNode = MENU_INDEX.get(state.currentNodeId);
  const selectedNode = resolveSelection(currentNode, normalizedInput);

  if (!selectedNode) {
    return handleInvalidInput(state);
  }

  if (selectedNode.type === 'menu') {
    return handleMenuNode(state, selectedNode);
  }

  if (selectedNode.type === 'knowledge_hook') {
    return handleKnowledgeHook(state, selectedNode);
  }

  if (selectedNode.type === 'placeholder') {
    return handlePlaceholder(selectedNode);
  }

  throw new Error(
    'Unsupported selected node type: ' + selectedNode.type
  );
}

module.exports = {
  STATE_VERSION,
  MAX_INPUT_LENGTH,
  createInitialState,
  normalizeInput,
  validateState,
  renderMenu,
  handleInput
};
