/**
 * @fileoverview Detect potential model poisoning vulnerabilities
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect code that could lead to model poisoning attacks',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      unvalidatedTrainingData: 'Training data not validated before use. Implement data validation to prevent poisoning.',
      dynamicModelUpdate: 'Dynamic model updates without validation. Ensure updates come from trusted sources.',
      unsafeModelLoading: 'Model loaded from untrusted source. Validate model integrity.',
      trainingLoopWithoutValidation: 'Training loop without input validation. Poisoned data could corrupt the model.',
    },
  },

  create(context) {
    const trainingDataVars = new Set();
    const modelVars = new Set();

    return {
      // Track training data variables
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Identify training data variables
          if (/(train|dataset|data|batch)/.test(varName)) {
            trainingDataVars.add(node.id.name);

            // Check if training data is used without validation
            if (node.init && !hasValidation(node.init)) {
              context.report({
                node,
                messageId: 'unvalidatedTrainingData',
              });
            }
          }

          // Identify model variables
          if (/(model|network|classifier|predictor)/.test(varName)) {
            modelVars.add(node.id.name);
          }
        }
      },

      // Check function calls for model operations
      CallExpression(node) {
        // Check model loading
        if (isModelLoadingCall(node)) {
          if (!isTrustedSource(node.arguments)) {
            context.report({
              node,
              messageId: 'unsafeModelLoading',
            });
          }
        }

        // Check model updates/training
        if (isModelUpdateCall(node)) {
          if (!hasValidationCheck(node)) {
            context.report({
              node,
              messageId: 'dynamicModelUpdate',
            });
          }
        }

        // Check training loops
        if (isTrainingLoop(node)) {
          if (!hasInputValidation(node)) {
            context.report({
              node,
              messageId: 'trainingLoopWithoutValidation',
            });
          }
        }
      },

      // Check assignments to training data
      AssignmentExpression(node) {
        if (node.left.type === 'Identifier' && trainingDataVars.has(node.left.name)) {
          if (!hasValidation(node.right)) {
            context.report({
              node,
              messageId: 'unvalidatedTrainingData',
            });
          }
        }
      },
    };

    function hasValidation(node) {
      // Simple check for validation patterns
      // In practice, this would need to be more sophisticated

      // Check if there's a validation call before this
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'CallExpression' && isValidationCall(parent)) {
          return true;
        }
        parent = parent.parent;
      }

      // Check for common validation patterns in the expression
      return containsValidationPattern(node);
    }

    function isValidationCall(node) {
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(validate|sanitize|check|verify|filter)/.test(funcName);
      }

      if (node.callee.type === 'MemberExpression') {
        const methodName = node.callee.property.name.toLowerCase();
        return /(validate|sanitize|check|verify|filter|isValid)/.test(methodName);
      }

      return false;
    }

    function containsValidationPattern(node) {
      // Check for common validation patterns
      if (node.type === 'CallExpression') {
        return isValidationCall(node);
      }

      if (node.type === 'BinaryExpression') {
        // Check for bounds checking like length > 0
        return node.operator === '>' || node.operator === '>=' ||
               node.operator === '<' || node.operator === '<=';
      }

      if (node.type === 'LogicalExpression') {
        // Check for logical validation
        return node.operator === '&&' || node.operator === '||';
      }

      return false;
    }

    function isModelLoadingCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && modelVars.has(object.name)) {
          return ['load', 'fromFile', 'fromPath', 'restore'].includes(method.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(loadModel|loadNetwork|restoreModel)/.test(funcName);
      }

      return false;
    }

    function isModelUpdateCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && modelVars.has(object.name)) {
          return ['update', 'train', 'fit', 'learn', 'fineTune'].includes(method.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(train|updateModel|fineTune)/.test(funcName);
      }

      return false;
    }

    function isTrainingLoop(node) {
      // Check for loops that contain training calls
      if (node.type === 'ForStatement' || node.type === 'WhileStatement' ||
          node.type === 'DoWhileStatement') {
        return containsTrainingCall(node.body);
      }

      // Check for array methods like forEach, map that might contain training
      if (node.callee && node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name;
        if (['forEach', 'map', 'reduce'].includes(method)) {
          return node.arguments.some(arg => containsTrainingCall(arg));
        }
      }

      return false;
    }

    function containsTrainingCall(node) {
      if (node.type === 'CallExpression') {
        return isModelUpdateCall(node);
      }

      if (node.type === 'BlockStatement') {
        return node.body.some(stmt => containsTrainingCall(stmt));
      }

      return false;
    }

    function isTrustedSource(args) {
      // Very basic check - in practice this would be more sophisticated
      for (const arg of args) {
        if (arg.type === 'Literal' && typeof arg.value === 'string') {
          const path = arg.value;
          // Consider local paths as trusted, remote URLs as untrusted
          if (path.startsWith('http') || path.startsWith('//')) {
            return false;
          }
        }
      }
      return true; // Assume trusted by default if no remote URLs found
    }

    function hasValidationCheck(node) {
      // Check if there are validation calls in the same scope
      let parent = node.parent;
      while (parent && parent.type !== 'FunctionDeclaration' && parent.type !== 'ArrowFunctionExpression') {
        if (parent.type === 'BlockStatement') {
          for (const stmt of parent.body) {
            if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
              if (isValidationCall(stmt.expression)) {
                return true;
              }
            }
          }
        }
        parent = parent.parent;
      }
      return false;
    }

    function hasInputValidation(node) {
      // Check for input validation in loops
      if (node.body && node.body.type === 'BlockStatement') {
        return node.body.body.some(stmt => {
          if (stmt.type === 'IfStatement') {
            return containsValidationPattern(stmt.test);
          }
          if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
            return isValidationCall(stmt.expression);
          }
          return false;
        });
      }
      return false;
    }
  },
};