import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchProducts } from '../api';

const SORTS = [
  { value: 'featured', label: 'Featured' },
  { value: 'best_selling', label: 'Best Selling' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'name_asc', label: 'A - Z' },
  { value: 'newest', label: 'Newest First' },
];

export default function Shop({ collectionSlug, collectionName }) {
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('featured');
  const [filters, setFilters] = useState({ collection: collectionSlug || '', minPrice: '', maxPrice: '' });
  const LIMIT = 24;

  const loadProducts = useCallback(async (pg = 1, reset = false) => {
    setLoading(true);
    try {
      const params = {
        sort,
        page: pg,
        limit: LIMIT,
        ...(filters.collection && { collection: filters.collection }),
        ...(filters.minPrice && { minPrice: filters.minPrice }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
        ...(searchParams.get('search') && { search: searchParams.get('search') }),
      };
      const res = await fetchProducts(params);
      setProducts(prev => reset || pg === 1 ? res.data.products : [...prev, ...res.data.products]);
      setTotal(res.data.total);
      setPage(pg);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [sort, filters, searchParams]);

  useEffect(() => {
    if (collectionSlug) {
      setFilters(prev => ({ ...prev, collection: collectionSlug }));
    }
  }, [collectionSlug]);

  useEffect(() => {
    loadProducts(1, true);
  }, [sort, filters, searchParams]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 bg-rose-50 border border-pinkborder rounded-sm px-6 py-5">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
          <Link to="/" className="hover:text-rose-600 transition-colors">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-rose-600 transition-colors">Collections</Link>
          {collectionName && (
            <>
              <span>/</span>
              <span className="text-rose-600 font-medium">{collectionName}</span>
            </>
          )}
        </nav>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-serif font-bold text-darktext leading-tight">
              {collectionName || 'All Products'}
            </h1>
            <div className="flex items-center gap-3 mt-2">
              <div className="h-px w-8 bg-rose-400" />
              <p className="text-xs text-gray-500 tracking-wide">{total} products found</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 uppercase tracking-widest">Sort:</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:border-rose-400 bg-white"
            >
              {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => <div key={i} className="h-72 bg-gray-100 animate-pulse" />)}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-xl font-medium text-maroon-900">No products found</p>
          <p className="mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
          {products.length < total && (
            <div className="text-center mt-10">
              <button
                onClick={() => loadProducts(page + 1)}
                disabled={loading}
                className="btn-outline px-10"
              >
                {loading ? 'Loading...' : `Load More (${total - products.length} remaining)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
