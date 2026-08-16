import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useProducts } from '../context/ProductsContext';
import { EmptyState } from '../components/EmptyState';
import { ProductCard } from '../components/ProductCard';

export function Wishlist() {
  const navigate = useNavigate();
  const { wishlist } = useApp();
  const { products } = useProducts();
  const wishlistedProducts = products.filter((p) => wishlist.includes(p.id));

  return (
    <div className="app-container">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold text-tg-text">Избранное</h1>
        {wishlistedProducts.length > 0 && (
          <p className="text-xs text-tg-hint">{wishlistedProducts.length} товаров</p>
        )}
      </header>

      <main className="scroll-area px-4">
        {wishlistedProducts.length > 0 ? (
          <div className="product-grid">
            {wishlistedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="💛"
            title="Здесь пока пусто"
            description="Добавляйте понравившиеся товары в избранное, чтобы быстро их находить"
            actionLabel="В каталог"
            onAction={() => navigate('/')}
          />
        )}
      </main>
    </div>
  );
}
