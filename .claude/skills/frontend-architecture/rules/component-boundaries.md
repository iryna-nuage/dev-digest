# Component boundaries: how to split and package components

Source ids like `[S16]` refer to [../README.md](../README.md). In-component rules (purity,
effects, memoization, keys, render factories, size and prop-count limits) belong to the
`react-best-practices` skill and the Rules of React [S17]. They are not repeated here.

## Contents
- Split by responsibility
- Component folder anatomy
- Private sub-components vs shared components
- Views, not containers
- Composition over configuration
- Shared UI stays domain-agnostic
- Third-party components

## Split by responsibility

- One component does one job. If it grows to do several, decompose it into subcomponents
  [S16].
- Let the data model guide the hierarchy: well-structured data maps naturally onto the
  component tree [S16].
- Split when a part has its own state, its own data source, a different reason to change, or
  a second consumer. Also split when the props list keeps growing because the component
  handles several concerns [S15].
- Don't split a fragment that has no logic of its own and only makes sense inside its parent.
  Keep it in the same file.
- Never define a component inside another component's body. Extract it as a named component
  that receives data through props [S15].

## Component folder anatomy

A component that has supporting files gets its own folder [S12] [S13]:

```
<Name>/
  <Name>.tsx          # the component
  index.ts            # re-exports this one component (entry point, not an aggregating barrel)
  <Name>.test.tsx     # colocated test
  helpers.ts          # pure functions used only here      → helpers-and-utils.md
  constants.ts        # static values used only here       → constants-and-config.md
  styles.ts | .css    # styles, if the styling approach uses files
  types.ts            # types used only here (optional)
  _components/        # sub-components private to <Name>
```

Comeau names the supporting files `<Name>.helpers.ts`, `<Name>.constants.ts` [S13]. Wieruch
uses plain names inside the folder [S12]. Either works. Use whichever the project already uses.

## Private sub-components vs shared components

- A child component used only by its parent lives inside the parent's folder (`_components/`
  or a sibling file). Code outside the parent never imports it.
- When a second component outside the parent needs it, promote it by the rule in
  [project-structure.md](project-structure.md). Don't import it across folders in place.

## Views, not containers

- Dan Abramov, who popularized "presentational vs container components", later withdrew the
  recommendation. Custom hooks provide the same separation without a wrapper component [S21]
  [S22].
- Put orchestration (data, state, mutations) in a custom hook named for the use case. The
  component calls the hook and renders [S18] [S24]. See
  [business-logic.md](business-logic.md) for the layers.

## Composition over configuration

- Use `children` and named slot props so a wrapper doesn't need to know its content. In
  Next.js this also lets server-rendered UI sit inside a client wrapper without joining the
  client bundle [S2].
- For a family of tightly coupled parts that share implicit state (tabs, menus, selects), use
  compound components that share state through context [S23].
- When a component starts taking flags that switch between unrelated layouts, split it into
  separate components that compose shared parts. A component with layout-switching flags is
  the "wrong abstraction" warned about in [S33].

## Shared UI stays domain-agnostic

- Shared and common components (buttons, inputs, cards) are used everywhere and belong in one
  shared place [S15].
- Shared UI components receive data through props. They never fetch data, read feature
  stores, or import from `features/` or routes. Dependency flow is one-way [S6] (see
  [module-boundaries.md](module-boundaries.md)).
- A component that renders a domain concept with domain rules (for example a "status badge"
  with business thresholds) belongs to that domain's feature, or to the shared layer
  together with its pure domain helper. It doesn't belong in a generic UI kit.

## Third-party components

- Wrap third-party UI behind your own component so you can swap the library in one place
  [S15].
- In Next.js, a third-party component that uses client-only features without `'use client'`
  needs your own client wrapper before a Server Component can render it [S2].
