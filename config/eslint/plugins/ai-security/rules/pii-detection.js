/**
 * @fileoverview Detect potential PII (Personally Identifiable Information) in AI contexts
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Detect potential PII in AI code and prompts',
      category: 'Security',
      recommended: true,
    },
    schema: [],
    messages: {
      potentialPII: 'Potential PII detected: {{type}}. Ensure this data is properly anonymized before use in AI contexts.',
    },
  },

  create(context) {
    const allowlist = [
      // Synthetic/test domains (RFC 2606 / common placeholders)
      /@example\.(com|org|net)\b/i,
      /\bexample\.(com|org|net)\b/i,
      // Explicit fake marker
      /\bfake\b/i,
    ];

    const piiPatterns = [
      // Email patterns
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      // Phone numbers (various formats)
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      /\b\(\d{3}\)\s*\d{3}[-.]?\d{4}\b/,
      // Social Security Numbers (US)
      /\b\d{3}[-]?\d{2}[-]?\d{4}\b/,
      // IP addresses
      /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
      // Credit card patterns (basic)
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      // Names (common first names)
      /\b(john|jane|michael|sarah|david|lisa|james|emily)\s+(smith|johnson|williams|brown|jones)\b/i,
    ];

    return {
      Literal(node) {
        if (typeof node.value === 'string') {
          const value = node.value;

          // Skip if it's clearly not PII (too short, or contains only symbols)
          if (value.length < 3 || !/[a-zA-Z]/.test(value)) {
            return;
          }

          // Skip synthetic/fake data
          for (const safe of allowlist) {
            if (safe.test(value)) {
              return;
            }
          }

          for (const pattern of piiPatterns) {
            if (pattern.test(value)) {
              context.report({
                node,
                messageId: 'potentialPII',
                data: {
                  type: 'pattern match',
                },
              });
              break; // Report only once per literal
            }
          }
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        const fullString = node.quasis.map(quasi => quasi.value.raw).join('');

        for (const safe of allowlist) {
          if (safe.test(fullString)) {
            return;
          }
        }

        for (const pattern of piiPatterns) {
          if (pattern.test(fullString)) {
            context.report({
              node,
              messageId: 'potentialPII',
              data: {
                type: 'pattern match in template',
              },
            });
            break;
          }
        }
      },
    };
  },
};