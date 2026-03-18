/**
 * @fileoverview Запрет мутаций `state` в store-updaters/селекторных функциях.
 *
 * Guardrail-правило: апдейтеры должны быть pure и возвращать новый объект state.
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow mutating `state` (assign/update/delete, mutating calls)',
    },
    schema: [],
    messages: {
      noMutation: 'Запрещено мутировать `state`. Используй pure updater и возвращай новый state.',
    },
  },
  create(context) {
    function isStateMember(node) {
      return node
        && node.type === 'MemberExpression'
        && !node.computed
        && node.object
        && node.object.type === 'Identifier'
        && node.object.name === 'state';
    }

    function isStateIdentifier(node) {
      return node && node.type === 'Identifier' && node.name === 'state';
    }

    const MUTATING_METHODS = new Set([
      'push',
      'pop',
      'shift',
      'unshift',
      'splice',
      'sort',
      'reverse',
      'copyWithin',
      'fill',
      // Мутаторы Map/Set (если по ошибке держим их в state)
      'set',
      'add',
      'delete',
      'clear',
    ]);

    return {
      AssignmentExpression(node) {
        if (isStateMember(node.left) || isStateIdentifier(node.left)) {
          context.report({ node, messageId: 'noMutation' });
        }
      },
      UpdateExpression(node) {
        if (isStateMember(node.argument) || isStateIdentifier(node.argument)) {
          context.report({ node, messageId: 'noMutation' });
        }
      },
      UnaryExpression(node) {
        if (node.operator === 'delete' && isStateMember(node.argument)) {
          context.report({ node, messageId: 'noMutation' });
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee && callee.type === 'MemberExpression' && !callee.computed) {
          const obj = callee.object;
          const prop = callee.property;
          if (prop && prop.type === 'Identifier' && MUTATING_METHODS.has(prop.name)) {
            // state.*.push(...) / stateMap.set(...) — любые mutating вызовы
            if (isStateMember(obj) || isStateIdentifier(obj)) {
              context.report({ node, messageId: 'noMutation' });
            }
          }
        }
      },
    };
  },
};

export default rule;
