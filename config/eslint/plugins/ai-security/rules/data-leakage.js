/**
 * @fileoverview Detect potential data leakage in AI pipelines
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect potential data leakage in AI pipelines and training data',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      trainingDataExposure: 'Training data exposed in logs or responses. Never log training data.',
      sensitiveDataInResponse: 'Sensitive data included in AI response. Filter responses before sending to users.',
      unfilteredResponse: 'AI response not filtered before output. Implement content filtering.',
      debugModeDataLeak: 'Debug mode may expose sensitive training data. Disable in production.',
    },
  },

  create(context) {
    const sensitiveDataPatterns = [
      /\btraining[_-]data/i,
      /\bdataset/i,
      /\blabel/i,
      /\bground[_-]truth/i,
      /\bvalidation[_-]set/i,
      /\btest[_-]data/i,
    ];

    const responseMethods = [
      'send', 'json', 'render', 'end', 'write',
      'respond', 'reply', 'return', 'output'
    ];

    return {
      // Check console.log and similar logging calls
      CallExpression(node) {
        if (isLoggingCall(node)) {
          checkForSensitiveData(node.arguments, node);
        }

        // Check response methods
        if (isResponseMethod(node)) {
          checkResponseForSensitiveData(node.arguments, node);
        }

        // Check for debug mode
        if (isDebugModeCall(node)) {
          context.report({
            node,
            messageId: 'debugModeDataLeak',
          });
        }
      },

      // Check return statements
      ReturnStatement(node) {
        if (node.argument) {
          checkForSensitiveDataInExpression(node.argument, node);
        }
      },

      // Check variable assignments that might contain training data
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Flag variables that likely contain training data
          if (sensitiveDataPatterns.some(pattern => pattern.test(varName))) {
            // Check if this variable is used in responses or logs
            // This is a simplified check - in practice you'd need more context
            if (node.init) {
              checkForSensitiveDataInExpression(node.init, node);
            }
          }
        }
      },

      // Check object properties
      Property(node) {
        if (node.key.type === 'Identifier') {
          const propName = node.key.name.toLowerCase();

          if (sensitiveDataPatterns.some(pattern => pattern.test(propName))) {
            context.report({
              node,
              messageId: 'trainingDataExposure',
            });
          }
        }
      },
    };

    function isLoggingCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        return (object.type === 'Identifier' && object.name === 'console' &&
                ['log', 'info', 'warn', 'error', 'debug'].includes(method.name));
      }

      // Check for other logging libraries
      if (node.callee.type === 'Identifier') {
        return ['logger', 'log', 'debug'].includes(node.callee.name.toLowerCase());
      }

      return false;
    }

    function isResponseMethod(node) {
      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property;
        return responseMethods.includes(method.name);
      }

      if (node.callee.type === 'Identifier') {
        return responseMethods.includes(node.callee.name);
      }

      return false;
    }

    function isDebugModeCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        // Check for debug mode settings
        if (object.type === 'Identifier' && ['process', 'config'].includes(object.name) &&
            method.name === 'env') {
          return true;
        }
      }

      return false;
    }

    function checkForSensitiveData(args, reportNode) {
      for (const arg of args) {
        if (containsSensitiveData(arg)) {
          context.report({
            node: reportNode,
            messageId: 'trainingDataExposure',
          });
          break;
        }
      }
    }

    function checkResponseForSensitiveData(args, reportNode) {
      for (const arg of args) {
        if (containsSensitiveData(arg)) {
          context.report({
            node: reportNode,
            messageId: 'sensitiveDataInResponse',
          });
          break;
        }
      }
    }

    function checkForSensitiveDataInExpression(expr, reportNode) {
      if (containsSensitiveData(expr)) {
        context.report({
          node: reportNode,
          messageId: 'trainingDataExposure',
        });
      }
    }

    function containsSensitiveData(node) {
      // Check literals
      if (node.type === 'Literal') {
        if (typeof node.value === 'string') {
          const value = node.value.toLowerCase();
          return sensitiveDataPatterns.some(pattern => pattern.test(value));
        }
      }

      // Check identifiers
      if (node.type === 'Identifier') {
        const name = node.name.toLowerCase();
        return sensitiveDataPatterns.some(pattern => pattern.test(name));
      }

      // Check member expressions
      if (node.type === 'MemberExpression') {
        const fullName = getMemberExpressionName(node);
        return sensitiveDataPatterns.some(pattern => pattern.test(fullName));
      }

      // Check arrays and objects recursively
      if (node.type === 'ArrayExpression') {
        return node.elements.some(element => element && containsSensitiveData(element));
      }

      if (node.type === 'ObjectExpression') {
        return node.properties.some(prop => {
          if (prop.type === 'Property') {
            return containsSensitiveData(prop.value);
          }
          if (prop.type === 'SpreadElement') {
            return containsSensitiveData(prop.argument);
          }
          return false;
        });
      }

      return false;
    }

    function getMemberExpressionName(node) {
      let name = '';
      let current = node;

      while (current && current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
          name = current.property.name + (name ? '.' + name : '');
        }
        current = current.object;
      }

      if (current && current.type === 'Identifier') {
        name = current.name + (name ? '.' + name : '');
      }

      return name.toLowerCase();
    }
  },
};