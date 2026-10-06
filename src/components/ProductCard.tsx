import type { Product } from "../types";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  formatPrice,
  formatQuantity,
  formatWeight,
  pricePerKgLabel,
  quantityStep,
} from "../utils/format";
import { HeartIcon, StarIcon } from "./Icons";
export function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate(),
    { cart, addToCart, updateQuantity, toggleWishlist, isWishlisted } =
      useApp();
  const quantity = cart.find((i) => i.product.id === product.id)?.quantity || 0,
    unit = product.unit || "шт",
    weight = unit !== "шт",
    step = quantityStep(unit);
  const discount =
    product.oldPrice && product.oldPrice > product.price
      ? Math.round((1 - product.price / product.oldPrice) * 100)
      : null;
  return (
    <article className="section-card">
      <button
        onClick={() => navigate(`/product/${product.id}`)}
        className="relative w-full aspect-square block overflow-hidden bg-tg-secondary-bg"
      >
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {(discount || product.badge) && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded-md bg-tg-button text-tg-button-text">
            {discount ? `−${discount}%` : product.badge}
          </span>
        )}
        {!product.inStock && (
          <span className="absolute inset-0 bg-black/40 text-white flex items-center justify-center text-sm">
            Нет в наличии
          </span>
        )}
      </button>
      <div className="p-2.5">
        <div className="flex gap-1">
          <button
            onClick={() => navigate(`/product/${product.id}`)}
            className="flex-1 text-left text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]"
          >
            {product.name}
          </button>
          <button
            aria-label={
              isWishlisted(product.id) ? "Убрать из избранного" : "В избранное"
            }
            onClick={() => toggleWishlist(product.id)}
            className="w-8 h-8 shrink-0 text-tg-hint"
          >
            <HeartIcon
              className="w-5 h-5 mx-auto"
              filled={isWishlisted(product.id)}
            />
          </button>
        </div>
        <p className="text-xs text-tg-hint min-h-4 mt-1">
          {product.packageLabel ||
            (weight
              ? `На ${unit === "кг" ? "вес" : "розлив"}`
              : product.weight
                ? formatWeight(product.weight)
                : "1 шт.")}
        </p>
        {product.reviewsCount > 0 && (
          <p className="flex items-center gap-1 mt-1 text-xs text-tg-hint">
            <StarIcon className="w-3.5 h-3.5 text-amber-400" />
            {product.rating} · {product.reviewsCount} оценок
          </p>
        )}
        <p className="font-bold text-base mt-2">
          {formatPrice(
            quantity && weight ? product.price * quantity : product.price,
          )}
          {weight && (
            <span className="text-xs font-normal text-tg-hint">
              {quantity ? ` / ${formatQuantity(quantity)} ${unit}` : `/${unit}`}
            </span>
          )}
        </p>
        {product.oldPrice && (
          <p className="line-through text-xs text-tg-hint">
            {formatPrice(product.oldPrice)}
            {weight ? `/${unit}` : ""}
          </p>
        )}
        {!weight && product.weight && !product.packageLabel && (
          <p className="text-[11px] text-tg-hint">
            {pricePerKgLabel(product.price, unit, product.weight)}
          </p>
        )}
        {product.inStock &&
          (quantity ? (
            <div className="flex items-center justify-between mt-2 bg-tg-secondary-bg rounded-xl">
              <button
                aria-label={`Уменьшить ${product.name}`}
                className="w-10 h-10 text-lg"
                onClick={() => updateQuantity(product.id, quantity - step)}
              >
                −
              </button>
              <span className="text-xs font-semibold">
                {formatQuantity(quantity)} {unit}
              </span>
              <button
                aria-label={`Добавить ${product.name}`}
                className="w-10 h-10 text-lg"
                onClick={() => updateQuantity(product.id, quantity + step)}
              >
                +
              </button>
            </div>
          ) : (
            <button
              onClick={() => addToCart(product)}
              className="btn-primary w-full py-2 mt-2 text-sm"
              aria-label={`В корзину: ${product.name}`}
            >
              + {weight ? `${formatQuantity(step)} ${unit}` : "В корзину"}
            </button>
          ))}
      </div>
    </article>
  );
}
