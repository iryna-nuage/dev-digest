# Business logic placement

Source ids like `[S24]` refer to [../README.md](../README.md).

## Contents
- The four layers
- Dependency direction
- Deciding where a piece of logic goes
- Example
- How far to go

## The four layers

Keep React as the view layer only, and split non-view logic by responsibility [S24]:

| Layer | Owns | Must not | Source |
|---|---|---|---|
| **View** (component) | Rendering, mapping events to hook calls | Compute business rules, call the API client directly | [S24] [S25] |
| **Hook** (orchestration) | Combining server data, UI state and mutations for one use case | Hold business rules inline; render | [S18] [S24] [S25] |
| **Domain** (pure functions or models) | Business rules: calculations, validation rules, status derivation, transformations | Import React, the API client, or browser APIs | [S24] [S26] |
| **API layer** (gateway) | One configured client, plus per-endpoint fetchers with request/response types and schemas | Contain UI decisions | [S7] [S24] |

In data-fetching-library setups, the per-endpoint query or mutation hook sits next to its
fetcher in the API layer [S7]. Use-case hooks compose those hooks.

## Dependency direction

`view → hook → domain` and `hook → API layer`. Domain depends on nothing app-specific. Only
outer layers depend on inner ones [S26]. A domain function that needs data receives it as an
argument and never fetches it. Use cases that need services can receive them as parameters
(dependency injection), which keeps them testable without module mocks [S25].

## Deciding where a piece of logic goes

1. Would the rule still hold if the UI were redesigned or the framework replaced? → **domain**
   [S26].
2. Is it about *which* data to load, *when* to refetch, or *what* to do after a mutation? →
   **hook**.
3. Is it about *how it looks*: layout, conditional rendering, formatting for display only? →
   **view**. A reusable display formatter goes in a helper.
4. Is it about transport: URLs, headers, serialization, response validation? → **API layer** [S7].
5. Does it need secrets, authorization or direct database access in a Next.js app? → server-only
   **Data Access Layer** ([nextjs-architecture.md](nextjs-architecture.md)) [S3].

## Example

```ts
// model/order.ts — domain: pure, no React, unit-tested
export function orderTotal(lines: OrderLine[], discount: Discount | null): Money {
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  return discount ? applyDiscount(subtotal, discount) : subtotal;
}

// hooks/use-checkout.ts — orchestration for one use case
export function useCheckout(cartId: string) {
  const cart = useCart(cartId);              // API-layer query hook
  const submit = useSubmitOrder();           // API-layer mutation hook
  const total = cart.data ? orderTotal(cart.data.lines, cart.data.discount) : null;
  return { cart, total, submit: () => submit.mutate(cartId) };
}

// CheckoutPanel.tsx — view: render + wire events
export function CheckoutPanel({ cartId }: { cartId: string }) {
  const { cart, total, submit } = useCheckout(cartId);
  if (cart.isPending) return <Spinner />;
  return <Summary total={total} onSubmit={submit} />;
}
```

## How far to go

- Applications evolve in steps: a single component, then multiple components, then logic in
  hooks, then domain models, then a fully layered app [S24]. Climb a step only when the
  current one hurts.
- For small apps, the best value for the effort is extracting the domain and respecting the
  dependency direction. Full ports-and-adapters clean architecture is often overkill early on
  [S26].
- Separating business logic lets you unit-test each branch without rendering components or
  building integration setups [S25].
