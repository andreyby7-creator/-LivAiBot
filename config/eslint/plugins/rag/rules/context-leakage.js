/**
 * @fileoverview Detect potential context leakage in RAG systems
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect potential context leakage between different users/sessions in RAG systems',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      sharedContextStorage: 'Context stored in shared/global variable. Use isolated context per user/session.',
      contextNotCleared: 'Context not cleared between requests. Implement proper cleanup.',
      globalContextUsage: 'Global context object used. Ensure proper isolation between users.',
      sessionContextLeak: 'Session context may leak between different users. Use unique identifiers.',
    },
  },

  create(context) {
    const contextVars = new Set();
    const globalVars = new Set(['global', 'window', 'process']);

    return {
      // Track context-related variables
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Identify context variables
          if (/(context|ctx|session|userContext)/.test(varName)) {
            contextVars.add(node.id.name);

            // Check if context is stored globally
            if (isGlobalStorage(node)) {
              context.report({
                node,
                messageId: 'sharedContextStorage',
              });
            }
          }

          // Check for global context objects
          if (/^(global|shared)Context$/.test(varName)) {
            context.report({
              node,
              messageId: 'globalContextUsage',
            });
          }
        }
      },

      // Check assignments
      AssignmentExpression(node) {
        if (node.left.type === 'Identifier' && contextVars.has(node.left.name)) {
          if (isGlobalAssignment(node)) {
            context.report({
              node,
              messageId: 'sharedContextStorage',
            });
          }
        }

        // Check assignments to global objects
        if (node.left.type === 'MemberExpression') {
          if (isGlobalMemberAssignment(node.left)) {
            context.report({
              node,
              messageId: 'globalContextUsage',
            });
          }
        }
      },

      // Check function calls
      CallExpression(node) {
        // Check for context operations that might leak
        if (isContextOperation(node)) {
          checkForContextLeak(node);
        }

        // Check for cleanup operations
        if (isCleanupCall(node)) {
          // This is good - cleanup is present
          return;
        }
      },

      // Check return statements
      ReturnStatement(node) {
        if (node.argument && containsContextData(node.argument)) {
          // Check if this function should return context
          const functionNode = getFunctionParent(node);
          if (functionNode && !isContextHandlerFunction(functionNode)) {
            context.report({
              node,
              messageId: 'contextNotCleared',
            });
          }
        }
      },

      // Check object properties
      Property(node) {
        if (node.key.type === 'Identifier') {
          const propName = node.key.name.toLowerCase();

          if (/(context|ctx|session)/.test(propName)) {
            // Check if this is part of a global object
            let parent = node.parent;
            while (parent) {
              if (parent.type === 'VariableDeclarator' && isGlobalStorage(parent)) {
                context.report({
                  node,
                  messageId: 'globalContextUsage',
                });
                break;
              }
              parent = parent.parent;
            }
          }
        }
      },
    };

    function isGlobalStorage(node) {
      // Check if variable is declared at module level (global)
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'Program') {
          return true; // Module-level declaration
        }
        if (parent.type === 'FunctionDeclaration' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'ArrowFunctionExpression') {
          return false; // Local to function
        }
        parent = parent.parent;
      }
      return false;
    }

    function isGlobalAssignment(node) {
      if (node.left.type === 'Identifier') {
        return globalVars.has(node.left.name);
      }
      return false;
    }

    function isGlobalMemberAssignment(memberExpr) {
      if (memberExpr.object.type === 'Identifier') {
        return globalVars.has(memberExpr.object.name);
      }
      return false;
    }

    function isContextOperation(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && contextVars.has(object.name)) {
          return ['set', 'get', 'update', 'store', 'save'].includes(method.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(storeContext|saveContext|getContext|updateContext)/.test(funcName);
      }

      return false;
    }

    function checkForContextLeak(node) {
      // Check if context operation lacks user/session isolation
      const args = node.arguments;

      // Look for user/session identifiers in arguments
      const hasUserIdentifier = args.some(arg => {
        if (arg.type === 'Identifier') {
          const name = arg.name.toLowerCase();
          return /(user|session|userId|sessionId)/.test(name);
        }
        return false;
      });

      if (!hasUserIdentifier) {
        context.report({
          node,
          messageId: 'sessionContextLeak',
        });
      }
    }

    function isCleanupCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && contextVars.has(object.name)) {
          return ['clear', 'reset', 'cleanup', 'destroy'].includes(method.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(clearContext|resetContext|cleanupContext)/.test(funcName);
      }

      return false;
    }

    function containsContextData(node) {
      if (node.type === 'Identifier' && contextVars.has(node.name)) {
        return true;
      }

      if (node.type === 'MemberExpression') {
        return node.object.type === 'Identifier' && contextVars.has(node.object.name);
      }

      return false;
    }

    function getFunctionParent(node) {
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'FunctionDeclaration' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'ArrowFunctionExpression') {
          return parent;
        }
        parent = parent.parent;
      }
      return null;
    }

    function isContextHandlerFunction(functionNode) {
      // Check function name for context handling
      if (functionNode.id && functionNode.id.type === 'Identifier') {
        const funcName = functionNode.id.name.toLowerCase();
        return /(context|ctx|session)/.test(funcName);
      }

      // Check parameters for context-related names
      if (functionNode.params) {
        return functionNode.params.some(param => {
          if (param.type === 'Identifier') {
            const paramName = param.name.toLowerCase();
            return /(context|ctx|session)/.test(paramName);
          }
          return false;
        });
      }

      return false;
    }
  },
};