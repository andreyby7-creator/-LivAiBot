/**
 * @fileoverview Ensure safe orchestration in multi-agent systems
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure safe orchestration patterns and prevent cascading failures in multi-agent systems',
      category: 'Reliability',
      recommended: true,
    },
    schema: [],
    messages: {
      missingErrorHandling: 'Orchestration without error handling. Implement circuit breakers and fallbacks.',
      cascadingFailure: 'Potential cascading failure. Implement isolation between agents.',
      missingTimeout: 'No timeout for agent operation. Prevent hanging orchestration.',
      unsafeParallelExecution: 'Unsafe parallel agent execution. Implement proper synchronization.',
      missingDeadlockDetection: 'No deadlock detection in agent orchestration.',
    },
  },

  create(context) {
    const orchestrationVars = new Set();
    const agentVars = new Set();

    return {
      // Track orchestration and agent variables
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Identify orchestration variables
          if (/(orchestrator|orchestration|coordinator|workflow)/.test(varName)) {
            orchestrationVars.add(node.id.name);
          }

          // Identify agent variables
          if (/(agent|bot|assistant|worker)/.test(varName)) {
            agentVars.add(node.id.name);
          }
        }
      },

      // Check async operations
      CallExpression(node) {
        // Check orchestration calls
        if (isOrchestrationCall(node)) {
          checkOrchestrationSafety(node);
        }

        // Check agent execution calls
        if (isAgentExecutionCall(node)) {
          checkAgentExecutionSafety(node);
        }

        // Check parallel execution
        if (isParallelExecution(node)) {
          checkParallelSafety(node);
        }
      },

      // Check Promise operations
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression') {
          const object = node.callee.object;
          const method = node.callee.property;

          // Check Promise.all operations
          if (object.type === 'Identifier' && object.name === 'Promise' &&
              method.name === 'all') {
            checkPromiseAllSafety(node);
          }

          // Check Promise.race operations
          if (object.type === 'Identifier' && object.name === 'Promise' &&
              method.name === 'race') {
            checkPromiseRaceSafety(node);
          }
        }
      },

      // Check await expressions
      AwaitExpression(node) {
        // Check for timeouts on awaited operations
        checkForTimeout(node);
      },

      // Check try-catch blocks
      TryStatement(node) {
        // Check if orchestration has proper error handling
        if (isInOrchestrationContext(node)) {
          validateErrorHandling(node);
        }
      },

      // Check loops that might cause deadlocks
      ForStatement(node) {
        if (isInOrchestrationContext(node)) {
          checkForDeadlockPotential(node);
        }
      },

      WhileStatement(node) {
        if (isInOrchestrationContext(node)) {
          checkForDeadlockPotential(node);
        }
      },
    };

    function isOrchestrationCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;

        if (object.type === 'Identifier' && orchestrationVars.has(object.name)) {
          return ['run', 'execute', 'start', 'coordinate'].includes(node.callee.property.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(orchestrate|coordinate|runWorkflow)/.test(funcName);
      }

      return false;
    }

    function checkOrchestrationSafety(node) {
      // Check for error handling
      const hasErrorHandling = hasNearbyTryCatch(node) || hasErrorCallback(node);

      if (!hasErrorHandling) {
        context.report({
          node,
          messageId: 'missingErrorHandling',
        });
      }

      // Check for timeouts
      if (!hasTimeout(node)) {
        context.report({
          node,
          messageId: 'missingTimeout',
        });
      }
    }

    function isAgentExecutionCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;

        if (object.type === 'Identifier' && agentVars.has(object.name)) {
          return ['run', 'execute', 'process', 'handle'].includes(node.callee.property.name);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(runAgent|executeAgent|processWithAgent)/.test(funcName);
      }

      return false;
    }

    function checkAgentExecutionSafety(node) {
      // Check for isolation and error boundaries
      const args = node.arguments;
      const hasIsolation = args.some(arg => {
        if (arg.type === 'ObjectExpression') {
          return arg.properties.some(prop => {
            if (prop.key.type === 'Identifier') {
              return ['isolate', 'sandbox', 'errorBoundary', 'circuitBreaker'].includes(prop.key.name);
            }
            return false;
          });
        }
        return false;
      });

      if (!hasIsolation) {
        context.report({
          node,
          messageId: 'cascadingFailure',
        });
      }
    }

    function isParallelExecution(node) {
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        // Check for parallel execution patterns
        if (object.type === 'Identifier' && orchestrationVars.has(object.name)) {
          return ['parallel', 'concurrent', 'batch'].includes(method.name);
        }
      }

      // Check for Promise.all, Promise.allSettled, etc.
      if (node.callee.type === 'MemberExpression') {
        const object = node.callee.object;
        const method = node.callee.property;

        if (object.type === 'Identifier' && object.name === 'Promise') {
          return ['all', 'allSettled'].includes(method.name);
        }
      }

      return false;
    }

    function checkParallelSafety(node) {
      // Check if parallel execution has proper error isolation
      const args = node.arguments;

      for (const arg of args) {
        if (arg.type === 'ArrayExpression') {
          // Check each element in the array
          const hasUnsafeElements = arg.elements.some(element => {
            if (element.type === 'CallExpression') {
              return !hasErrorHandling(element);
            }
            return false;
          });

          if (hasUnsafeElements) {
            context.report({
              node,
              messageId: 'unsafeParallelExecution',
            });
            break;
          }
        }
      }
    }

    function checkPromiseAllSafety(node) {
      const args = node.arguments;

      if (args.length > 0 && args[0].type === 'ArrayExpression') {
        const promises = args[0].elements;

        // Check if any promise lacks error handling
        const hasUnsafePromises = promises.some(promise => {
          if (promise.type === 'CallExpression') {
            return !hasErrorHandling(promise);
          }
          return false;
        });

        if (hasUnsafePromises) {
          context.report({
            node,
            messageId: 'unsafeParallelExecution',
          });
        }
      }
    }

    function checkPromiseRaceSafety(node) {
      // Promise.race can be problematic in orchestration as first failure wins
      context.report({
        node,
        messageId: 'cascadingFailure',
      });
    }

    function checkForTimeout(node) {
      // Check if awaited operation has timeout
      const callExpr = node.argument;

      if (callExpr && callExpr.type === 'CallExpression') {
        if (!hasTimeout(callExpr)) {
          context.report({
            node,
            messageId: 'missingTimeout',
          });
        }
      }
    }

    function hasNearbyTryCatch(node) {
      let parent = node.parent;
      let depth = 0;

      while (parent && depth < 3) { // Check up to 3 levels up
        if (parent.type === 'TryStatement') {
          return true;
        }

        if (parent.type === 'FunctionDeclaration' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'ArrowFunctionExpression') {
          break; // Don't look beyond function boundaries
        }

        parent = parent.parent;
        depth++;
      }

      return false;
    }

    function hasErrorCallback(node) {
      const args = node.arguments;

      return args.some(arg => {
        if (arg.type === 'FunctionExpression' || arg.type === 'ArrowFunctionExpression') {
          // Check if function has error parameter
          if (arg.params && arg.params.length > 0) {
            const firstParam = arg.params[0];
            if (firstParam.type === 'Identifier') {
              return /^(error|err|e)$/.test(firstParam.name);
            }
          }
        }
        return false;
      });
    }

    function hasTimeout(node) {
      const args = node.arguments;

      return args.some(arg => {
        if (arg.type === 'ObjectExpression') {
          return arg.properties.some(prop => {
            if (prop.key.type === 'Identifier') {
              return ['timeout', 'maxWait', 'deadline'].includes(prop.key.name);
            }
            return false;
          });
        }
        return false;
      });
    }

    function hasErrorHandling(node) {
      return hasNearbyTryCatch(node) || hasErrorCallback(node);
    }

    function isInOrchestrationContext(node) {
      let parent = node.parent;

      while (parent) {
        if (parent.type === 'FunctionDeclaration' ||
            parent.type === 'FunctionExpression' ||
            parent.type === 'ArrowFunctionExpression') {
          if (parent.id && parent.id.type === 'Identifier') {
            const funcName = parent.id.name.toLowerCase();
            return /(orchestrat|coordinat|workflow|multiagent)/.test(funcName);
          }
        }

        // Check for orchestration variable usage
        if (parent.type === 'VariableDeclarator' &&
            parent.id.type === 'Identifier' &&
            orchestrationVars.has(parent.id.name)) {
          return true;
        }

        parent = parent.parent;
      }

      return false;
    }

    function validateErrorHandling(tryStmt) {
      // Check if catch block has proper error handling
      if (tryStmt.handler) {
        const catchBlock = tryStmt.handler.body;

        // Check if catch block has meaningful error handling
        const hasErrorHandling = catchBlock.body.some(stmt => {
          if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
            const callee = stmt.expression.callee;
            if (callee.type === 'Identifier') {
              return ['log', 'report', 'handle', 'fallback'].some(method =>
                callee.name.toLowerCase().includes(method)
              );
            }
          }
          if (stmt.type === 'ReturnStatement') {
            return true; // Returning from catch is a form of handling
          }
          return false;
        });

        if (!hasErrorHandling) {
          context.report({
            node: tryStmt,
            messageId: 'missingErrorHandling',
          });
        }
      }
    }

    function checkForDeadlockPotential(node) {
      // Check for loops that might cause deadlocks in orchestration

      // Look for agent communication or state changes in loops
      const hasAgentOps = containsAgentOperations(node.body);

      if (hasAgentOps) {
        // Check if loop has termination conditions
        const hasTermination = hasLoopTermination(node);

        if (!hasTermination) {
          context.report({
            node,
            messageId: 'missingDeadlockDetection',
          });
        }
      }
    }

    function containsAgentOperations(node) {
      if (node.type === 'BlockStatement') {
        return node.body.some(stmt => containsAgentOperations(stmt));
      }

      if (node.type === 'ExpressionStatement' && node.expression.type === 'CallExpression') {
        return isAgentExecutionCall(node.expression) || isOrchestrationCall(node.expression);
      }

      if (node.type === 'VariableDeclaration') {
        return node.declarations.some(decl => {
          if (decl.init && decl.init.type === 'CallExpression') {
            return isAgentExecutionCall(decl.init) || isOrchestrationCall(decl.init);
          }
          return false;
        });
      }

      return false;
    }

    function hasLoopTermination(node) {
      // Check for loop conditions that ensure termination
      if (node.type === 'ForStatement') {
        return node.test !== null; // Has test condition
      }

      if (node.type === 'WhileStatement') {
        return node.test !== null;
      }

      // For other types, assume they have some termination logic
      return true;
    }
  },
};