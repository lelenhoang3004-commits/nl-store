export function syncProductVariantState(state, productLike = {}) {
  const productId = Number(productLike?.id ?? productLike?.productId);
  if (!Number.isFinite(productId) || productId <= 0) return state;

  const variants = Array.isArray(productLike?.variants) ? productLike.variants : null;
  const variantCount = Number.isFinite(Number(productLike?.variantCount))
    ? Number(productLike.variantCount)
    : (variants ? variants.length : null);

  if (state?.detail && Number(state.detail.id) === productId) {
    state.detail = {
      ...state.detail,
      variantCount: variantCount ?? Number(state.detail.variantCount || 0),
      variants: variants ?? (Array.isArray(state.detail.variants) ? state.detail.variants : [])
    };
  }

  if (Array.isArray(state?.items)) {
    const index = state.items.findIndex((item) => Number(item.id) === productId);
    if (index >= 0) {
      const currentItem = state.items[index];
      state.items[index] = {
        ...currentItem,
        variantCount: variantCount ?? Number(currentItem.variantCount || 0),
        variants: variants ?? (Array.isArray(currentItem.variants) ? currentItem.variants : [])
      };
    }
  }

  return state;
}
