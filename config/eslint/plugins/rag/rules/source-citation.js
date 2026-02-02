/**
 * @fileoverview Ensure proper source citation in RAG systems
 * @author LivAi Team
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Ensure proper source citation and attribution in RAG-generated responses',
      category: 'Reliability',
      recommended: true,
    },
    schema: [],
    messages: {
      missingSourceCitation: 'RAG response without source citation. Include source references.',
      incompleteCitation: 'Citation missing required information (source, page/section, date).',
      hardcodedCitation: 'Hardcoded citation text. Use dynamic citation generation.',
      noCitationValidation: 'No validation of citation accuracy. Implement citation verification.',
    },
  },

  create(context) {
    const responseVars = new Set();
    const citationVars = new Set();
    const sourceVars = new Set();

    return {
      // Track response and citation variables
      VariableDeclarator(node) {
        if (node.id.type === 'Identifier') {
          const varName = node.id.name.toLowerCase();

          // Identify response variables
          if (/(response|answer|result|output)/.test(varName)) {
            responseVars.add(node.id.name);
          }

          // Identify citation variables
          if (/(citation|reference|source|attribution)/.test(varName)) {
            citationVars.add(node.id.name);
          }

          // Identify source variables
          if (/(source|document|doc|reference)/.test(varName)) {
            sourceVars.add(node.id.name);
          }
        }
      },

      // Check return statements for responses
      ReturnStatement(node) {
        if (node.argument) {
          checkForCitationRequirement(node.argument, node);
        }
      },

      // Check function calls that return responses
      CallExpression(node) {
        // Check for response generation calls
        if (isResponseGenerationCall(node)) {
          checkForCitationInResponseCall(node);
        }

        // Check for citation generation calls
        if (isCitationCall(node)) {
          validateCitationCompleteness(node);
        }
      },

      // Check string literals for hardcoded citations
      Literal(node) {
        if (typeof node.value === 'string') {
          const text = node.value;

          // Check for citation-like patterns
          if (isCitationText(text)) {
            if (isHardcodedCitation(text)) {
              context.report({
                node,
                messageId: 'hardcodedCitation',
              });
            }
          }
        }
      },

      // Check template literals
      TemplateLiteral(node) {
        const fullText = node.quasis.map(q => q.value.raw).join('INTERPOLATED');

        if (isCitationText(fullText)) {
          // Check if template has dynamic source information
          const hasSourceVars = node.expressions.some(expr => {
            if (expr.type === 'Identifier') {
              return sourceVars.has(expr.name) || citationVars.has(expr.name);
            }
            return false;
          });

          if (!hasSourceVars && node.expressions.length === 0) {
            context.report({
              node,
              messageId: 'hardcodedCitation',
            });
          }
        }
      },

      // Check object properties for citation fields
      Property(node) {
        if (node.key.type === 'Identifier') {
          const propName = node.key.name.toLowerCase();

          if (/(citation|reference|source|attribution)/.test(propName)) {
            if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
              validateCitationContent(node.value.value, node.value);
            }
          }
        }
      },

      // Check assignments
      AssignmentExpression(node) {
        if (node.left.type === 'Identifier' && responseVars.has(node.left.name)) {
          checkForCitationRequirement(node.right, node);
        }
      },
    };

    function checkForCitationRequirement(node, reportNode) {
      // Check if response includes citation
      if (isRagResponse(node)) {
        const hasCitation = containsCitation(node);

        if (!hasCitation) {
          context.report({
            node: reportNode,
            messageId: 'missingSourceCitation',
          });
        }
      }
    }

    function isRagResponse(node) {
      // Determine if this is a RAG-generated response
      // This is a heuristic - in practice you'd need more context

      if (node.type === 'Identifier' && responseVars.has(node.name)) {
        return true;
      }

      if (node.type === 'CallExpression') {
        return isResponseGenerationCall(node);
      }

      if (node.type === 'Literal' && typeof node.value === 'string') {
        const text = node.value.toLowerCase();
        // Look for RAG-related keywords in the response
        return /(according to|based on|source|reference)/.test(text) ||
               text.length > 100; // Long responses likely need citation
      }

      if (node.type === 'TemplateLiteral') {
        const text = node.quasis.map(q => q.value.raw).join('').toLowerCase();
        return /(according to|based on|source|reference)/.test(text) ||
               text.length > 100;
      }

      return false;
    }

    function containsCitation(node) {
      // Check if the node contains citation information

      if (node.type === 'Literal' && typeof node.value === 'string') {
        return isCitationText(node.value);
      }

      if (node.type === 'TemplateLiteral') {
        const fullText = node.quasis.map(q => q.value.raw).join('');
        return isCitationText(fullText);
      }

      if (node.type === 'Identifier') {
        return citationVars.has(node.name);
      }

      if (node.type === 'BinaryExpression' && node.operator === '+') {
        return containsCitation(node.left) || containsCitation(node.right);
      }

      if (node.type === 'CallExpression') {
        // Check if this returns a citation
        return node.arguments.some(arg => containsCitation(arg));
      }

      if (node.type === 'ObjectExpression') {
        return node.properties.some(prop => {
          if (prop.key.type === 'Identifier') {
            const propName = prop.key.name.toLowerCase();
            return /(citation|reference|source)/.test(propName);
          }
          return false;
        });
      }

      return false;
    }

    function isResponseGenerationCall(node) {
      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name;
        const object = node.callee.object;

        if (object.type === 'Identifier') {
          // Check for RAG-related method calls
          return /(rag|retrieval|generate|createResponse)/.test(object.name) &&
                 ['generate', 'create', 'build', 'get'].includes(method);
        }
      }

      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(generateResponse|createAnswer|ragQuery)/.test(funcName);
      }

      return false;
    }

    function checkForCitationInResponseCall(node) {
      // Check if response generation includes citation parameters
      const args = node.arguments;
      const hasCitationParam = args.some(arg => {
        if (arg.type === 'ObjectExpression') {
          return arg.properties.some(prop => {
            if (prop.key.type === 'Identifier') {
              return ['citation', 'references', 'sources', 'attribution'].includes(prop.key.name);
            }
            return false;
          });
        }
        return containsCitation(arg);
      });

      if (!hasCitationParam) {
        context.report({
          node,
          messageId: 'missingSourceCitation',
        });
      }
    }

    function isCitationCall(node) {
      if (node.callee.type === 'Identifier') {
        const funcName = node.callee.name.toLowerCase();
        return /(createCitation|generateCitation|formatCitation)/.test(funcName);
      }

      if (node.callee.type === 'MemberExpression') {
        const method = node.callee.property.name;
        return ['cite', 'reference', 'attribution'].includes(method);
      }

      return false;
    }

    function validateCitationCompleteness(node) {
      // Check if citation has required fields
      const args = node.arguments;

      for (const arg of args) {
        if (arg.type === 'ObjectExpression') {
          const properties = arg.properties;
          const hasSource = properties.some(p =>
            p.key.type === 'Identifier' && ['source', 'url', 'document'].includes(p.key.name)
          );
          const hasLocation = properties.some(p =>
            p.key.type === 'Identifier' && ['page', 'section', 'line'].includes(p.key.name)
          );
          const hasDate = properties.some(p =>
            p.key.type === 'Identifier' && ['date', 'timestamp'].includes(p.key.name)
          );

          if (!hasSource || !hasLocation) {
            context.report({
              node,
              messageId: 'incompleteCitation',
            });
          }
        }
      }
    }

    function isCitationText(text) {
      const citationPatterns = [
        /\[[\d\s,-]+\]/,  // [1, 2-3]
        /\([\w\s,.-]+\)/, // (Smith et al., 2023)
        /\[\d+\]/,        // [1]
        /source:/i,
        /reference:/i,
        /cited:/i,
        /according to/i,
      ];

      return citationPatterns.some(pattern => pattern.test(text));
    }

    function isHardcodedCitation(text) {
      // Check if citation appears to be hardcoded rather than generated
      return /\b(source|reference):\s*['"`]?example['"`]?/i.test(text) ||
             /\b(source|reference):\s*['"`]?placeholder['"`]?/i.test(text) ||
             /\b(source|reference):\s*['"`]?todo['"`]?/i.test(text);
    }

    function validateCitationContent(text, node) {
      // Check for required citation elements
      const hasSource = /(source|url|document)/i.test(text);
      const hasLocation = /(page|section|line|paragraph)/i.test(text);
      const hasDate = /\b(19|20)\d{2}\b/.test(text); // Year pattern

      if (!hasSource && !hasLocation) {
        context.report({
          node,
          messageId: 'incompleteCitation',
        });
      }
    }
  },
};