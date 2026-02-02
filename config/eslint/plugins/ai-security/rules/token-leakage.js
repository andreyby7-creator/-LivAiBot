/**
 * @fileoverview Detect potential API token leakage in AI code
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect hardcoded API tokens and keys that could be leaked',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      hardcodedToken: 'Potential API token/key detected: {{token}}. Use environment variables or secure key management.',
      suspiciousTokenPattern: 'Suspicious token-like pattern detected. Ensure this is not a leaked credential.',
    },
  },

  create(context) {
    // Common token/key patterns
    const tokenPatterns = [
      // API Keys (generic)
      /\b(api[_-]?key|apikey)\s*[:=]\s*['"`]([^'"`]{10,})['"`]/i,
      /\b(secret[_-]?key|secretkey)\s*[:=]\s*['"`]([^'"`]{10,})['"`]/i,

      // OpenAI patterns
      /\bsk-[a-zA-Z0-9]{48}\b/,
      /\bOPENAI_API_KEY\s*[:=]\s*['"`]([^'"`]{10,})['"`]/i,

      // Generic token patterns (long alphanumeric strings)
      /\b[a-zA-Z0-9]{32,}\b/, // 32+ chars, potentially a token

      // Bearer tokens in strings
      /\bBearer\s+[a-zA-Z0-9_\-\.]{20,}/i,

      // JWT tokens (basic pattern)
      /\beyJ[A-Za-z0-9-_]*\.eyJ[A-Za-z0-9-_]*\.[A-Za-z0-9-_]*\b/,

      // AWS access keys
      /\bAKIA[0-9A-Z]{16}\b/,
      /\b[a-zA-Z0-9]{40}\b/, // AWS secret keys are 40 chars

    ];

    // Known test/safe tokens to ignore
    const safeTokens = [
      /test[_-]?token/i,
      /example[_-]?key/i,
      /dummy[_-]?secret/i,
      /placeholder/i,
      /your[_-]?api[_-]?key[_-]?here/i,
      // Explicit fake marker / synthetic JWT
      /\bfake\b/i,
      /\bey\.fake\./i,
    ];

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          const value = node.value;

          // Ограничиваем длину для защиты от ReDoS на огромных строках
          if (value.length > 5000) {
            return;
          }

          // Skip very short strings or those that are clearly not tokens
          if (value.length < 10) {
            return;
          }

          // Check if it's a known safe token
          for (const safePattern of safeTokens) {
            if (safePattern.test(value)) {
              return;
            }
          }

          // Check for hardcoded token patterns
          for (const pattern of tokenPatterns) {
            const match = pattern.exec(value);
            if (match) {
              // For generic long strings, be more cautious
              if (pattern.source.includes('{32,}') && !/[a-z]/.test(value)) {
                // Skip if it's all caps or numbers only (might be constants)
                continue;
              }

              context.report({
                node,
                messageId: 'hardcodedToken',
                data: {
                  token: match[1] || match[0].substring(0, 20) + '...',
                },
              });
              return; // Report only once per literal
            }
          }
        }
      },

      // Check variable declarations for suspicious patterns
      VariableDeclarator(node) {
        if (node.init && node.init.type === 'Literal' && typeof node.init.value === 'string') {
          const varName = node.id.name;
          const value = node.init.value;

          // Check variable names that suggest tokens
          if (/^(api|secret|token|key)/i.test(varName) && value.length > 10) {
            context.report({
              node: node.init,
              messageId: 'suspiciousTokenPattern',
            });
          }
        }

        // Check DB URLs with credentials using URL parser (avoids regex backtracking)
        try {
          const url = new URL(node.init.value);
          const protocols = new Set(['mongodb:', 'postgresql:', 'mysql:']);
          if (protocols.has(url.protocol) && url.username && url.password) {
            context.report({
              node: node.init,
              messageId: 'hardcodedToken',
              data: {
                token: `${url.protocol}//${url.username}:***@${url.host}`,
              },
            });
            return;
          }
        } catch {
          // not a valid URL, ignore
        }
      },
    };
  },
};