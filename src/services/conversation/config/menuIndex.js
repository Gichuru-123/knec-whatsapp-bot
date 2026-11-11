'use strict';

const SUPPORTED_NODE_TYPES = new Set([
  'menu',
  'knowledge_hook',
  'placeholder'
]);

function buildMenuIndex(rootNode) {
  if (!rootNode || typeof rootNode !== 'object') {
    throw new Error('Menu tree root must be an object.');
  }

  const index = new Map();
  const parentIndex = new Map();

  function visit(node, parentId = null) {
    validateBasicNode(node);

    if (index.has(node.id)) {
      throw new Error('Duplicate menu node id: ' + node.id);
    }

    index.set(node.id, node);

    if (parentId !== null) {
      parentIndex.set(node.id, parentId);
    }

    if (node.type === 'menu') {
      if (!Array.isArray(node.children) || node.children.length === 0) {
        throw new Error('Menu node must contain children: ' + node.id);
      }

      for (const child of node.children) {
        visit(child, node.id);
      }
    }
  }

  visit(rootNode);

  for (const node of index.values()) {
    validateNodeRelationships(node, index);
  }

  return Object.freeze({
    rootId: rootNode.id,

    has(nodeId) {
      return index.has(nodeId);
    },

    get(nodeId) {
      return index.get(nodeId) || null;
    },

    getParent(nodeId) {
      const parentId = parentIndex.get(nodeId);

      if (!parentId) {
        return null;
      }

      return index.get(parentId) || null;
    },

    size() {
      return index.size;
    }
  });
}

function validateBasicNode(node) {
  if (!node || typeof node !== 'object') {
    throw new Error('Every menu node must be an object.');
  }

  if (typeof node.id !== 'string' || node.id.trim() === '') {
    throw new Error('Every menu node requires a non-empty id.');
  }

  if (typeof node.title !== 'string' || node.title.trim() === '') {
    throw new Error('Menu node requires a non-empty title: ' + node.id);
  }

  if ('description' in node &&
      (typeof node.description !== 'string' || node.description.trim() === '' || node.description.length > 120)) {
    throw new Error('Menu node description is invalid: ' + node.id);
  }

  if (!SUPPORTED_NODE_TYPES.has(node.type)) {
    throw new Error(
      'Unsupported menu node type "' + node.type + '" for node: ' + node.id
    );
  }

  if (node.type === 'knowledge_hook') {
    if (!node.action || typeof node.action !== 'object') {
      throw new Error('Knowledge hook requires an action: ' + node.id);
    }

    if (node.action.type !== 'knowledge_lookup') {
      throw new Error(
        'Unsupported knowledge hook action for node: ' + node.id
      );
    }

    if (
      typeof node.action.articleId !== 'string' ||
      node.action.articleId.trim() === ''
    ) {
      throw new Error(
        'Knowledge hook requires a non-empty articleId: ' + node.id
      );
    }

    if ('children' in node) {
      throw new Error(
        'Knowledge hook cannot contain children: ' + node.id
      );
    }
  }

  if (node.type === 'placeholder') {
    if (typeof node.message !== 'string' || node.message.trim() === '') {
      throw new Error(
        'Placeholder requires a non-empty message: ' + node.id
      );
    }

    if (
      typeof node.returnTo !== 'string' ||
      node.returnTo.trim() === ''
    ) {
      throw new Error(
        'Placeholder requires a non-empty returnTo target: ' + node.id
      );
    }

    if ('children' in node) {
      throw new Error(
        'Placeholder cannot contain children: ' + node.id
      );
    }
  }
}

function validateNodeRelationships(node, index) {
  if (node.type === 'placeholder' && !index.has(node.returnTo)) {
    throw new Error(
      'Placeholder returnTo target does not exist: ' +
        node.id +
        ' -> ' +
        node.returnTo
    );
  }
}

module.exports = {
  buildMenuIndex
};
