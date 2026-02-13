import { fromHtmlIsomorphic } from 'hast-util-from-html-isomorphic';
import { toText } from 'hast-util-to-text';
import katex from 'katex/dist/katex.mjs';
import { SKIP, visitParents } from 'unist-util-visit-parents';

export type RehypeKatexClientOptions = Record<string, unknown>;

export default function rehypeKatexClient(options?: RehypeKatexClientOptions | null) {
  const settings = options || {};

  return function (tree: any, file: any) {
    visitParents(tree, 'element', function (element: any, parents: any[]) {
      const classes = Array.isArray(element?.properties?.className) ? element.properties.className : [];
      const languageMath = classes.includes('language-math');
      const mathDisplay = classes.includes('math-display');
      const mathInline = classes.includes('math-inline');
      let displayMode = mathDisplay;

      if (!languageMath && !mathDisplay && !mathInline) return;

      let parent = parents[parents.length - 1];
      let scope = element;

      if (
        element.tagName === 'code' &&
        languageMath &&
        parent &&
        parent.type === 'element' &&
        parent.tagName === 'pre'
      ) {
        scope = parent;
        parent = parents[parents.length - 2];
        displayMode = true;
      }

      if (!parent) return;

      const value = toText(scope, { whitespace: 'pre' });

      let result: any;
      try {
        result = (katex as any).renderToString(value, {
          ...settings,
          displayMode,
          throwOnError: true,
        });
      } catch (error: any) {
        const cause = error instanceof Error ? error : new Error(String(error));
        try {
          result = (katex as any).renderToString(value, {
            ...settings,
            displayMode,
            strict: 'ignore',
            throwOnError: false,
          });
        } catch {
          file?.message?.('Could not render math with KaTeX', {
            ancestors: [...parents, element],
            cause,
            place: element.position,
            ruleId: (cause.name || 'katex').toLowerCase(),
            source: 'rehype-katex-client',
          });
          result = [
            {
              type: 'element',
              tagName: 'span',
              properties: {
                className: ['katex-error'],
                style: 'color:' + ((settings as any).errorColor || '#cc0000'),
                title: String(error),
              },
              children: [{ type: 'text', value }],
            },
          ];
        }
      }

      if (typeof result === 'string') {
        const root = fromHtmlIsomorphic(result, { fragment: true });
        result = root.children;
      }

      const index = parent.children.indexOf(scope);
      parent.children.splice(index, 1, ...result);
      return SKIP;
    });
  };
}

