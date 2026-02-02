/**
 * @fileoverview Ensure proper agent isolation in multi-agent systems
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure proper isolation between agents to prevent interference and data leakage',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      sharedStateAccess: 'Agent accessing shared state directly. Use isolated agent contexts.',
      crossAgentCommunication: 'Direct communication between agents detected. Use orchestration layer.',
      agentStateLeakage: 'Agent state may leak to other agents. Implement proper isolation.',
      missingAgentIdValidation: 'No agent ID validation in multi-agent operations. Ensure proper agent identification.',
    },
  },

  create(context) {
    const agentVars = new Set();
    const sharedVars = new Set();
    const stateVars = new Set();

    return {
      // Track agent-related variables
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Identify agent variables
          if (/(agent|bot|assistant|worker)/.test(varName)) {
            agentVars.add(node.id.name);
          }

          // Identify shared state variables
          if (/(shared|global|common)/.test(varName)) {
            sharedVars.add(node.id.name);
          }

          // Identify state variables
          if (/(state|context|memory|data)/.test(varName)) {
            stateVars.add(node.id.name);
          }
        }
      },

      // Check member access
      MemberExpression(node) {
        // Check for cross-agent state access
        if (node.object.type === 'Identifier') {
          const objectName = node.object.name;

          if (agentVars.has(objectName) && node.property.type === 'Identifier') {
            const propName = node.property.name.toLowerCase();

            // Check if accessing other agent's state
            if (/(state|context|memory|data)/.test(propName)) {
              checkForCrossAgentAccess(node);
            }
          }
        }
      },

      // Check function calls
      CallExpression(node) {
        // Check for agent operations
        if (isAgentOperation(node)) {
          checkAgentIsolation(node);
        }

        // Check for communication between agents
        if (isInterAgentCommunication(node)) {
          context.report({
            node,
            messageId: 'crossAgentCommunication',
          });
        }

        // Check for state sharing
        if (isStateSharingCall(node)) {
          validateStateSharing(node);
        }
      },

      // Check assignments
      AssignmentExpression(node) {
        // Check if agent is modifying shared state
        if (node.left.type === 'MemberExpression' &&
            node.left.object.type === 'Identifier' &&
            sharedVars.has(node.left.object.name)) {

          // Check if this assignment happens in agent context
          if (isInAgentContext(node)) {
            context.report({
              node,
              messageId: 'sharedStateAccess',
            });
          }
        }

        // Check agent-to-agent assignments
        if (isAgentToAgentAssignment(node)) {
          context.report({
            node,
            messageId: 'crossAgentCommunication',
          });
        }
      },

      // Check return statements
      ReturnStatement(node) {
        if (node.argument) {
          // Check if agent is returning its internal state
          if (containsAgentState(node.argument) && isInAgentFunction(node)) {
            context.report({
              node,
              messageId: 'agentStateLeakage',
            });
          }
        }
      },

      // Check function parameters
      FunctionDeclaration(node) {
        if (node.params) {
          // Check for agent ID parameters in multi-agent functions
          const hasAgentId = node.params.some(param => {
            if (param.type === 'Identifier') {
              const paramName = param.name.toLowerCase();
              return /(agentId|agent_id|agentid)/.test(paramName);
            }
            return false;
          });

          if (isMultiAgentFunction(node) && !hasAgentId) {
            context.report({
              node,
              messageId: 'missingAgentIdValidation',
            });
          }
        }
      },
    };

    function checkForCrossAgentAccess(node) {
      // Check if this access is happening in a different agent context
      const currentFunction = getFunctionParent(node);
      if (currentFunction) {
        const functionName = currentFunction.id ? currentFunction.id.name.toLowerCase() : '';

        // If we're in an agent function but accessing a different agent's state
        if (/(agent|bot)/.test(functionName) && node.object.name !== getCurrentAgentName(currentFunction)) {
          context.report({
            node,
            messageId: 'sharedStateAccess',
          });
        }
      }
    }

    function isAgentOperation(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && agentVars.has(object.name)) {
          return ['run', 'execute', 'process', 'handle'].includes(method.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(runAgent|executeAgent|processAgent)/.test(funcName);
      }

      return false;
    }

    function checkAgentIsolation(node) {
      // Check if agent operation has proper isolation
      const args = node.arguments;

      // Look for isolation parameters
      const hasIsolation = args.some(arg => {
        if (arg.type === 'ObjectExpression') {
          return arg.properties.some(prop => {
            if (prop.key.type === 'Identifier') {
              return ['isolated', 'sandbox', 'context', 'namespace'].includes(prop.key.name);
            }
            return false;
          });
        }
        return false;
      });

      if (!hasIsolation) {
        // Check if there are agent ID parameters
        const hasAgentId = args.some(arg => {
          if (arg.type === 'Identifier') {
            const argName = arg.name.toLowerCase();
            return /(agentId|agent_id|id)/.test(argName);
          }
          return false;
        });

        if (!hasAgentId) {
          context.report({
            node,
            messageId: 'missingAgentIdValidation',
          });
        }
      }
    }

    function isInterAgentCommunication(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && agentVars.has(object.name)) {
          return ['send', 'message', 'communicate', 'call'].includes(method.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(sendToAgent|messageAgent|agentCommunication)/.test(funcName);
      }

      return false;
    }

    function isStateSharingCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name;
        return ['share', 'broadcast', 'publish'].includes(method);
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(shareState|broadcastState|publishState)/.test(funcName);
      }

      return false;
    }

    function validateStateSharing(node) {
      // Check if state sharing has proper access controls
      const args = node.arguments;

      const hasAccessControl = args.some(arg => {
        if (arg.type === 'ObjectExpression') {
          return arg.properties.some(prop => {
            if (prop.key.type === 'Identifier') {
              return ['permissions', 'access', 'allowed', 'recipients'].includes(prop.key.name);
            }
            return false;
          });
        }
        return false;
      });

      if (!hasAccessControl) {
        context.report({
          node,
          messageId: 'agentStateLeakage',
        });
      }
    }

    function isAgentToAgentAssignment(node) {
      if (node.left.type === 'MemberExpression' &&
          node.left.object.type === 'Identifier' &&
          agentVars.has(node.left.object.name)) {

        if (node.right.type === 'Identifier' && agentVars.has(node.right.name)) {
          return node.left.object.name !== node.right.name;
        }
      }

      return false;
    }

    function containsAgentState(node) {
      if (node.type === 'Identifier' && stateVars.has(node.name)) {
        return true;
      }

      if (node.type === 'MemberExpression') {
        return node.object.type === 'Identifier' && stateVars.has(node.object.name);
      }

      if (node.type === 'ObjectExpression') {
        return node.properties.some(prop => {
          if (prop.key.type === 'Identifier') {
            const propName = prop.key.name.toLowerCase();
            return /(state|context|memory|internal)/.test(propName);
          }
          return false;
        });
      }

      return false;
    }

    function isInAgentContext(node) {
      let parent = node.parent;
      while (parent) {
        if (parent.type === 'FunctionDeclaration' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'ArrowFunctionExpression') {
          if (parent.id && parent.id.type === 'Identifier') {
            const funcName = parent.id.name.toLowerCase();
            return /(agent|bot|worker)/.test(funcName);
          }
        }
        parent = parent.parent;
      }
      return false;
    }

    function isInAgentFunction(node) {
      const func = getFunctionParent(node);
      return func && isAgentFunction(func);
    }

    function isAgentFunction(func) {
      if (func.id && func.id.type === 'Identifier') {
        const funcName = func.id.name.toLowerCase();
        return /(agent|bot|worker)/.test(funcName);
      }
      return false;
    }

    function isMultiAgentFunction(node) {
      if (node.id && node.id.type === 'Identifier') {
        const funcName = node.id.name.toLowerCase();
        return /(multi|orchestrate|coordinate)/.test(funcName) ||
               /(agent|bot)/.test(funcName) && /(system|manager|orchestrator)/.test(funcName);
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

    function getCurrentAgentName(func) {
      if (func.params) {
        for (const param of func.params) {
          if (param.type === 'Identifier') {
            const paramName = param.name.toLowerCase();
            if (/^(agent|bot|self)$/.test(paramName)) {
              return param.name;
            }
          }
        }
      }

      if (func.id) {
        return func.id.name;
      }

      return null;
    }
  },
};