/**
 * @fileoverview Disallow calling actions from selectors.
 *
 * Heuristic rule (guardrail): in functions named `selectX*` and in `selectors/` files,
 * disallow calls to `actions.*` and `*.actions.*`.
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow calling actions from selectors',
    },
    schema: [],
    messages: {
      noActionsInSelectors:
        'Selectors не должны вызывать actions. Вынеси side-effects/updates в actions или effects.',
    },
  },
  create(context) {
    const filename = context.getFilename?.() ?? '';
    const isSelectorsFile = /\/selectors\/.+\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filename);

    /** @type {Array<{ inSelector: boolean }>} */
    const fnStack = [];

    function isSelectorName(name) {
      return typeof name === 'string' && /^select[A-Z0-9_]/.test(name);
    }

    function currentIsSelector() {
      const top = fnStack[fnStack.length - 1];
      return Boolean(top && top.inSelector);
    }

    function enterFunction(node) {
      let inSelector = isSelectorsFile;
      if (!inSelector) {
        if (node.type === 'FunctionDeclaration' && node.id?.name) {
          inSelector = isSelectorName(node.id.name);
        } else if (
          (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression')
          && node.parent
          && node.parent.type === 'VariableDeclarator'
          && node.parent.id
          && node.parent.id.type === 'Identifier'
        ) {
          inSelector = isSelectorName(node.parent.id.name);
        }
      }
      fnStack.push({ inSelector });
    }

    function exitFunction() {
      fnStack.pop();
    }

    function isActionsCall(node) {
      if (!node || node.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (!callee || callee.type !== 'MemberExpression') return false;

      // actions.foo()
      if (callee.object.type === 'Identifier' && callee.object.name === 'actions') {
        return true;
      }

      // something.actions.foo()
      if (
        callee.object.type === 'MemberExpression'
        && !callee.object.computed
        && callee.object.property.type === 'Identifier'
        && callee.object.property.name === 'actions'
      ) {
        return true;
      }

      return false;
    }

    return {
      FunctionDeclaration: enterFunction,
      'FunctionDeclaration:exit': exitFunction,
      FunctionExpression: enterFunction,
      'FunctionExpression:exit': exitFunction,
      ArrowFunctionExpression: enterFunction,
      'ArrowFunctionExpression:exit': exitFunction,

      CallExpression(node) {
        if (!currentIsSelector()) return;
        if (!isActionsCall(node)) return;
        context.report({ node, messageId: 'noActionsInSelectors' });
      },
    };
  },
};

export default rule;
