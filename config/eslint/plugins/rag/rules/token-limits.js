/**
 * @fileoverview Detect potential token limit issues in RAG systems
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect potential token limit violations and inefficient token usage in RAG systems',
      category: 'Performance',
      recommended: true,
    },
    schema: [],
    messages: {
      noTokenLimitCheck: 'No token limit check before API call. Implement token counting and limits.',
      hardcodedTokenLimit: 'Hardcoded token limit detected. Use configurable limits.',
      inefficientTokenUsage: 'Potential inefficient token usage. Consider chunking or summarization.',
      missingTokenEstimation: 'No token count estimation before processing. Implement token budgeting.',
    },
  },

  create(context) {
    const tokenRelatedVars = new Set();
    const apiCallMethods = new Set(['fetch', 'axios', 'request', 'api.call', 'openai.createCompletion']);

    return {
      // Track token-related variables
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Identify token-related variables
          if (/(token|tokens|count|length|size)/.test(varName)) {
            tokenRelatedVars.add(node.id.name);
          }
        }
      },

      // Check function calls
      CallExpression(node) {
        // Check API calls that might exceed token limits
        if (isApiCall(node)) {
          checkForTokenLimits(node);
        }

        // Check for token counting functions
        if (isTokenCountingCall(node)) {
          // This is good - token counting is present
          return;
        }

        // Check for text processing without token awareness
        if (isTextProcessingCall(node)) {
          checkForTokenAwareness(node);
        }
      },

      // Check literals for hardcoded limits
      Literal(node) {
        if (typeof node.value === 'number') {
          const value = node.value;

          // Common token limits that might be hardcoded
          if ([4096, 8192, 16384, 32768, 65536, 100000, 128000].includes(value)) {
            // Check if this is in a context that suggests token limits
            if (isInTokenLimitContext(node)) {
              context.report({
                node,
                messageId: 'hardcodedTokenLimit',
              });
            }
          }
        }
      },

      // Check string literals for large text content
      Literal(node) {
        if (typeof node.value === 'string') {
          const text = node.value;
          const estimatedTokens = estimateTokenCount(text);

          // Flag very long strings that might cause token limit issues
          if (estimatedTokens > 2000) { // Rough threshold
            context.report({
              node,
              messageId: 'inefficientTokenUsage',
            });
          }
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        const fullText = node.quasis.map(q => q.value.raw).join('TEMPLATE_TEXT');
        const estimatedTokens = estimateTokenCount(fullText);

        if (estimatedTokens > 2000) {
          context.report({
            node,
            messageId: 'inefficientTokenUsage',
          });
        }
      },

      // Check array operations that might accumulate too much text
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression') {
          const method = node.callee.property.name;

          if (['join', 'concat'].includes(method)) {
            // Check if this might create very long strings
            const object = node.callee.object;
            if (object.type === 'Identifier') {
              const varName = object.name.toLowerCase();
              if (/(documents|chunks|texts|contents)/.test(varName)) {
                context.report({
                  node,
                  messageId: 'missingTokenEstimation',
                });
              }
            }
          }
        }
      },
    };

    function isApiCall(node) {
      // Check for HTTP requests
      if (node.callee.type === 'Identifier') {
        if (apiCallMethods.has(node.callee.name)) {
          return true;
        }
      }

      // Check for member expressions like api.call, openai.chat.completions.create
      if (node.callee.type === 'MemberExpression') {
        const fullCall = getFullMethodCall(node.callee);
        return /(api|openai|anthropic|cohere)\./.test(fullCall) ||
               /create(Chat|Completion)/.test(fullCall) ||
               /(completions|chat)/.test(fullCall);
      }

      return false;
    }

    function checkForTokenLimits(node) {
      // Check if there are token limit checks before the API call
      let hasTokenCheck = false;

      // Look for token-related variables or checks in the same scope
      let parent = node.parent;
      while (parent && parent.type !== 'FunctionDeclaration' &&
             parent.type !== 'ArrowFunctionExpression') {

        if (parent.type === 'BlockStatement') {
          hasTokenCheck = parent.body.some(stmt => containsTokenCheck(stmt));
        }

        parent = parent.parent;
      }

      if (!hasTokenCheck) {
        // Check the arguments of the API call for token parameters
        const hasTokenParam = node.arguments.some(arg => {
          if (arg.type === 'ObjectExpression') {
            return arg.properties.some(prop => {
              if (prop.key.type === 'Identifier') {
                return ['max_tokens', 'maxTokens', 'token_limit', 'tokenLimit'].includes(prop.key.name);
              }
              return false;
            });
          }
          return false;
        });

        if (!hasTokenParam) {
          context.report({
            node,
            messageId: 'noTokenLimitCheck',
          });
        }
      }
    }

    function isTokenCountingCall(node) {
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(countTokens|estimateTokens|getTokenCount)/.test(funcName);
      }

      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name;
        return ['encode', 'count'].includes(method.toLowerCase());
      }

      return false;
    }

    function isTextProcessingCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name;
        return ['split', 'substring', 'slice', 'substr'].includes(method);
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(chunk|split|process|embed)/.test(funcName);
      }

      return false;
    }

    function checkForTokenAwareness(node) {
      // Check if text processing considers token limits
      const args = node.arguments;

      // Look for token-related parameters
      const hasTokenParam = args.some(arg => {
        if (arg.type === 'Identifier' && tokenRelatedVars.has(arg.name)) {
          return true;
        }
        if (arg.type === 'Literal' && typeof arg.value === 'number') {
          // Check for reasonable token chunk sizes
          return arg.value > 100 && arg.value < 10000;
        }
        return false;
      });

      if (!hasTokenParam) {
        context.report({
          node,
          messageId: 'missingTokenEstimation',
        });
      }
    }

    function containsTokenCheck(stmt) {
      if (stmt.type === 'VariableDeclaration') {
        return stmt.declarations.some(decl => {
          return decl.id.type === 'Identifier' &&
                 /(token|count|limit)/.test(decl.id.name.toLowerCase());
        });
      }

      if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'CallExpression') {
        return isTokenCountingCall(stmt.expression);
      }

      if (stmt.type === 'IfStatement') {
        return containsTokenCheckInCondition(stmt.test);
      }

      return false;
    }

    function containsTokenCheckInCondition(node) {
      if (node.type === 'BinaryExpression') {
        return node.left.type === 'Identifier' && tokenRelatedVars.has(node.left.name);
      }

      if (node.type === 'CallExpression') {
        return isTokenCountingCall(node);
      }

      return false;
    }

    function isInTokenLimitContext(node) {
      // Check if the number literal is in a context that suggests token limits
      let parent = node.parent;

      while (parent) {
        if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
          const varName = parent.id.name.toLowerCase();
          return /(maxTokens|tokenLimit|maxToken|limit)/.test(varName);
        }

        if (parent.type === 'Property') {
          if (parent.key.type === 'Identifier') {
            const propName = parent.key.name.toLowerCase();
            return /(maxTokens|tokenLimit|maxToken|limit)/.test(propName);
          }
        }

        if (parent.type === 'BinaryExpression') {
          return parent.left.type === 'Identifier' &&
                 /(length|size|count)/.test(parent.left.name.toLowerCase());
        }

        parent = parent.parent;
      }

      return false;
    }

    function getFullMethodCall(callee) {
      let call = '';
      let current = callee;

      while (current && current.type === 'MemberExpression') {
        if (current.property.type === 'Identifier') {
          call = current.property.name + (call ? '.' + call : '');
        }
        current = current.object;
      }

      if (current && current.type === 'Identifier') {
        call = current.name + (call ? '.' + call : '');
      }

      return call;
    }

    function estimateTokenCount(text) {
      // Very rough estimation: ~4 characters per token for English text
      // This is a simplification - actual tokenization is more complex
      return Math.ceil(text.length / 4);
    }
  },
};