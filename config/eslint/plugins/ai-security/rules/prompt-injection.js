/**
 * @fileoverview Detect potential prompt injection vulnerabilities
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect unsafe prompt construction that could lead to injection attacks',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      unsafeStringConcat: 'Unsafe string concatenation in prompt construction. Use parameterized prompts or sanitization.',
      userInputInPrompt: 'User input directly inserted into prompt. Sanitize or escape user input.',
      dynamicPromptConstruction: 'Dynamic prompt construction detected. Ensure proper input validation.',
    },
  },

  create(context) {
    // Track variables that might contain user input
    const userInputVars = new Set();
    const promptConstructionVars = new Set();

    return {
      // Track variables that receive user input
      VariableDeclarator(node) {
        if (node.init) {
          // Check for common user input sources
          if (isUserInputSource(node.init)) {
            if (node.id.type === 'Identifier') {
              userInputVars.add(node.id.name);
            }
          }

          // Check for prompt construction
          if (isPromptConstruction(node.init)) {
            if (node.id.type === 'Identifier') {
              promptConstructionVars.add(node.id.name);
            }
          }
        }
      },

      // Check assignments
      AssignmentExpression(node) {
        if (node.left.type === 'Identifier') {
          if (isUserInputSource(node.right)) {
            userInputVars.add(node.left.name);
          }
          if (isPromptConstruction(node.right)) {
            promptConstructionVars.add(node.left.name);
          }
        }
      },

      // Check function calls and string operations
      CallExpression(node) {
        // Check for string concatenation that includes user input
        if (isStringConcatenationWithUserInput(node, userInputVars)) {
          context.report({
            node,
            messageId: 'unsafeStringConcat',
          });
        }

        // Check for template literals with user input
        if (node.callee.type === 'Identifier' && node.callee.name === 'eval') {
          // Eval is always dangerous
          context.report({
            node,
            messageId: 'unsafeStringConcat',
          });
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        const expressions = node.expressions;

        // Check if template contains user input
        for (const expr of expressions) {
          if (isUserInputExpression(expr, userInputVars)) {
            context.report({
              node,
              messageId: 'userInputInPrompt',
            });
            break;
          }
        }

        // Check for dynamic prompt patterns
        const fullTemplate = node.quasis.map(q => q.value.raw).join('${}');
        if (/(system|user|assistant)\s*prompt/i.test(fullTemplate) && expressions.length > 0) {
          context.report({
            node,
            messageId: 'dynamicPromptConstruction',
          });
        }
      },

      // Check binary expressions (string concatenation)
      BinaryExpression(node) {
        if (node.operator === '+') {
          if (isUserInputInBinaryExpression(node, userInputVars)) {
            context.report({
              node,
              messageId: 'unsafeStringConcat',
            });
          }
        }
      },
    };

    function isUserInputSource(node) {
      // Common sources of user input
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        const callee = node.callee;
        if (callee.object.type === 'Identifier' && callee.object.name === 'req') {
          // Express.js patterns: req.body, req.query, req.params
          if (['body', 'query', 'params'].includes(callee.property.name)) {
            return true;
          }
        }
      }

      // Function parameters (common in API handlers)
      if (node.type === 'Identifier') {
        const name = node.name;
        if (/^(userInput|input|data|payload|request)$/i.test(name)) {
          return true;
        }
      }

      return false;
    }

    function isPromptConstruction(node) {
      if (node.type === 'Literal' && typeof node.value === 'string') {
        const value = node.value.toLowerCase();
        return /(prompt|instruction|system|user|assistant)/.test(value) && value.length > 20;
      }
      return false;
    }

    function isUserInputExpression(expr, userInputVars) {
      if (expr.type === 'Identifier' && userInputVars.has(expr.name)) {
        return true;
      }

      // Check member expressions like req.body
      if (expr.type === 'MemberExpression' && expr.object.type === 'Identifier') {
        if (expr.object.name === 'req' || userInputVars.has(expr.object.name)) {
          return true;
        }
      }

      return false;
    }

    function isStringConcatenationWithUserInput(node, userInputVars) {
      // Check methods like join(), concat(), etc.
      if (node.callee.type === 'MemberExpression' &&
          ['join', 'concat'].includes(node.callee.property.name)) {
        return node.arguments.some(arg => isUserInputExpression(arg, userInputVars));
      }
      return false;
    }

    function isUserInputInBinaryExpression(node, userInputVars) {
      return isUserInputExpression(node.left, userInputVars) ||
             isUserInputExpression(node.right, userInputVars);
    }
  },
};