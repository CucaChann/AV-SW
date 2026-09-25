import type { Fact, Family, Library, Product, Review, Selector } from "./schema";

/** Anything the rules engine can read specs from. */
export type SpecCarrier = {
  id: string;
  specs: Record<string, Fact>;
  review: Review;
};

export function isVerified(item: { review: Review }) {
  return item.review.status === "verified";
}

export function matchesSelector(
  selector: Selector,
  product: Pick<Product, "id" | "manufacturerId" | "familyId">,
  family?: Pick<Family, "ecosystemIds">,
) {
  if (selector.productId && selector.productId !== product.id) return false;
  if (selector.familyId && selector.familyId !== product.familyId) return false;
  if (selector.manufacturerId && selector.manufacturerId !== product.manufacturerId) return false;
  if (selector.ecosystemId && !family?.ecosystemIds.includes(selector.ecosystemId)) return false;
  return true;
}

/**
 * A product's specs with its family's specs as defaults. The result is only
 * verified when both the product and its family are.
 */
export function resolveProduct(library: Library, productId: string): SpecCarrier | null {
  const product = library.products.find((p) => p.id === productId);
  if (!product) return null;
  const family = library.families.find((f) => f.id === product.familyId);
  const bothVerified = isVerified(product) && (!family || isVerified(family));
  return {
    id: product.id,
    specs: { ...(family?.specs ?? {}), ...product.specs },
    review: bothVerified ? product.review : { ...product.review, status: "proposed" },
  };
}

export function numberSpec(item: SpecCarrier, key: string) {
  const fact = item.specs[key];
  return fact && typeof fact.value === "number" ? { value: fact.value, fact } : null;
}
