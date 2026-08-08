import type { Product } from '../types';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatPrice } from '../utils/format';
import { HeartIcon, StarIcon } from './Icons';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { addToCart, toggleWishlist, isWishlisted } = useApp();
  const wishlisted = isWishlisted(product.id);

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className="section-card cursor-pointer active:scale-[0.98] transition-transform"
    >
      <div className="relative aspect-square overflow-hidden bg-tg-secondary-bg">
        <img
          src={product.image}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        {product.badge && (
          <span className="absolute top-2 left-2 px-2 py-0.5 text-xs font-bold rounded-md bg-tg-button text-tg-buttonText">
            {product.badge}
          </span>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">Нет в наличии</span>
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className={`absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full backdrop-blur-md transition-all active:scale-90 ${
            wishlisted ? 'text-red-500 bg-white/80' : 'text-gray-600 bg-white/60'
          }`}
        >
          <HeartIcon className="w-5 h-5" filled={wishlisted} />
        </button>
      </div>
      <div className="p-2.5">
        <h3 className="text-sm font-medium text-tg-text line-clamp-2 leading-snug min-h-[2.5rem]">
          {product.name}
        </h3>
        <div className="flex items-center gap-1 mt-1">
          <StarIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs text-tg-hint">{product.rating}</span>
        </div>
        <div className="flex items-end justify-between mt-1.5 gap-1">
          <div className="min-w-0">
            <div className="text-base font-bold text-tg-text truncate">
              {formatPrice(product.price)}
            </div>
            {product.oldPrice && (
              <div className="text-xs text-tg-hint line-through">
                {formatPrice(product.oldPrice)}
              </div>
            )}
          </div>
          {product.inStock && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                addToCart(product);
              }}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-tg-button text-tg-buttonText text-xl font-bold active:scale-90 transition-transform"
              aria-label="В корзину"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
