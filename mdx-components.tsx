import type { MDXComponents } from 'mdx/types'
 
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="font-montserrat text-4xl font-semibold mb-6">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="font-montserrat text-2xl font-semibold mb-4 mt-8">{children}</h2>
    ),
    p: ({ children }) => (
      <p className="font-opensans text-secondary mb-4">{children}</p>
    ),
    code: ({ children }) => (
      <code className="bg-secondary/10 px-1 py-0.5 rounded">{children}</code>
    ),
    pre: ({ children }) => (
      <pre className="bg-secondary/10 p-4 rounded-sm mb-4 overflow-x-auto">
        {children}
      </pre>
    ),
    ...components,
  }
}