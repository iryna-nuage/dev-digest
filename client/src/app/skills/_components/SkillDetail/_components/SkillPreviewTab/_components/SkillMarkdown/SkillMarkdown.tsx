/* SkillMarkdown — the skill body as a document: headings, lists, emphasis and
   code get their own spacing (the shared `Markdown` primitive styles inline
   text only, so headings and lists would read as plain lines). */
"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { s } from "./styles";

export function SkillMarkdown({ children }: { children: string }) {
  return (
    <div style={s.root}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 style={s.h1}>{children}</h1>,
          h2: ({ children }) => <h2 style={s.h2}>{children}</h2>,
          h3: ({ children }) => <h3 style={s.h3}>{children}</h3>,
          h4: ({ children }) => <h4 style={s.h3}>{children}</h4>,
          p: ({ children }) => <p style={s.p}>{children}</p>,
          ul: ({ children }) => <ul style={s.ul}>{children}</ul>,
          ol: ({ children }) => <ol style={s.ol}>{children}</ol>,
          li: ({ children }) => <li style={s.li}>{children}</li>,
          strong: ({ children }) => <strong style={s.strong}>{children}</strong>,
          pre: ({ children }) => <pre className="mono" style={s.pre}>{children}</pre>,
          code: ({ children, className }) =>
            className ? (
              <code>{children}</code>
            ) : (
              <code className="mono" style={s.code}>
                {children}
              </code>
            ),
          blockquote: ({ children }) => <blockquote style={s.quote}>{children}</blockquote>,
          a: ({ children, href }) => (
            <a href={href} style={s.a}>
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
