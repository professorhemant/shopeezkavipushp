import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { fetchProducts, fetchCollections } from '../api';

const testimonials = [
  { name: 'Priya Sharma', location: 'Delhi', text: 'The Dulhan jewellery set was absolutely stunning! Got so many compliments on my wedding day. Quality exceeded my expectations.', rating: 5 },
  { name: 'Anjali Mehta', location: 'Mumbai', text: 'Ordered the crimson lehenga and it was even more beautiful in person. Kavipushp truly understands the Indian bride!', rating: 5 },
  { name: 'Ritu Kapoor', location: 'Jaipur', text: 'Amazing quality at such affordable prices. The packaging was premium too. Will definitely order again!', rating: 5 },
];

const categories = [
  { label: 'Necklace Sets', slug: 'necklace-sets', count: 48 },
  { label: 'Earrings & Jhumkas', slug: 'earrings-jhumkas', count: 62 },
  { label: 'Maang Tikka & Passa', slug: 'maang-tikka', count: 31 },
  { label: 'Kaleere & Haath Phool', slug: 'kaleere-haath-phool', count: 18 },
  { label: 'Bangles & Kada', slug: 'bangles-kada', count: 44 },
  { label: 'Bridal Lehengas', slug: 'bridal-lehengas', count: 27 },
  { label: 'Bridal Sarees', slug: 'bridal-sarees', count: 19 },
  { label: 'Dulhan Collection', slug: 'dulhan-collection', count: 35 },
];

const galleryImages = [
  'https://picsum.photos/seed/g1/300/380',
  'https://picsum.photos/seed/g2/300/380',
  'https://picsum.photos/seed/g3/300/380',
  'https://picsum.photos/seed/g4/300/380',
  'https://picsum.photos/seed/g5/300/380',
  'https://picsum.photos/seed/g6/300/380',
];

function Stars({ n }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`w-3.5 h-3.5 ${s <= n ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState('bestsellers');
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchProducts({ featured: 'true', limit: 40 }),
      fetchProducts({ new_arrival: 'true', limit: 40 }),
      fetchCollections(),
    ]).then(([featured, newArr, cols]) => {
      setFeaturedProducts(featured.data.products);
      setNewArrivals(newArr.data.products);
      setCollections(cols.data.slice(0, 6));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const displayProducts = tab === 'bestsellers' ? featuredProducts : newArrivals;

  return (
    <div className="bg-white">

      {/* ── HERO BANNER ── */}
      <section className="relative w-full overflow-hidden" style={{ height: '70vh', minHeight: '380px' }}>
        <img
          src="/banners/banner7.png"
          alt="New Arrivals"
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <p className="text-xs tracking-widest uppercase text-rose-300 mb-3 font-semibold">New Collection 2024</p>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight mb-5 drop-shadow-lg">
            New Arrivals
          </h1>
          <p className="text-white/80 text-sm md:text-base mb-8 max-w-md">
            Handpicked jewellery for the modern Indian bride — look like royalty.
          </p>
          <div className="flex gap-3 flex-wrap justify-center">
            <Link to="/shop" className="bg-white text-gray-900 px-7 py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-rose-600 hover:text-white transition-colors">
              Shop Now
            </Link>
            <Link to="/collections/necklace-sets" className="border border-white text-white px-7 py-2.5 text-xs font-bold tracking-widest uppercase hover:bg-white hover:text-gray-900 transition-colors">
              Necklace Sets
            </Link>
          </div>
        </div>
      </section>

      {/* ── NEW ARRIVALS ── */}
      <section className="w-full px-2 md:px-6 py-10">
        {/* Main Content */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="section-label">Just In</p>
              <h2 className="section-title">New Arrivals</h2>
            </div>
            <Link to="/collections/new-arrivals" className="text-xs font-semibold text-rose-600 tracking-widest uppercase hover:underline hidden sm:block">View All →</Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {(newArrivals.length ? newArrivals : featuredProducts).map(p => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── BANNER STRIP ── */}
      <section className="bg-rose-600 text-white py-10 text-center">
        <p className="section-label text-rose-200">Limited Time</p>
        <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Bridal Season Sale — Up to 40% Off</h2>
        <p className="text-rose-100 mb-6 text-sm">On select lehengas, jewellery sets and more. Ends soon.</p>
        <Link to="/shop" className="bg-white text-rose-600 px-8 py-3 text-sm font-bold tracking-widest uppercase hover:bg-rose-50 transition-colors inline-block">Shop the Sale</Link>
      </section>

      {/* ── BEST SELLERS ── */}
      <section className="w-full px-2 md:px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="section-label">Customer Favourites</p>
            <h2 className="section-title">Best Sellers</h2>
          </div>
          <div className="flex border border-gray-200 text-xs font-semibold tracking-widest uppercase">
            <button
              onClick={() => setTab('bestsellers')}
              className={`px-4 py-2 transition-colors ${tab === 'bestsellers' ? 'bg-darktext text-white' : 'text-gray-500 hover:text-darktext'}`}
            >
              Best Sellers
            </button>
            <button
              onClick={() => setTab('newarrivals')}
              className={`px-4 py-2 border-l border-gray-200 transition-colors ${tab === 'newarrivals' ? 'bg-darktext text-white' : 'text-gray-500 hover:text-darktext'}`}
            >
              New Arrivals
            </button>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="aspect-[3/4] bg-gray-100 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {displayProducts.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}

        <div className="text-center mt-10">
          <Link to="/shop" className="btn-outline">View All Products</Link>
        </div>
      </section>

      {/* ── COLLECTIONS GRID ── */}
      <section className="bg-rose-50 py-10">
        <div className="w-full px-2 md:px-6">
          <div className="text-center mb-10">
            <p className="section-label">Browse By</p>
            <h2 className="section-title">Our Collections</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {collections.map(c => (
              <Link key={c.id} to={`/collections/${c.slug}`} className="group relative overflow-hidden bg-white border border-pinkborder">
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={c.image_url || `https://picsum.photos/seed/${c.slug}/400/300`}
                    alt={c.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-4 flex items-center justify-between">
                  <p className="font-serif font-bold text-darktext text-sm">{c.name}</p>
                  <svg className="w-4 h-4 text-rose-600 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                  </svg>
                </div>
              </Link>
            ))}
          </div>
          <div className="text-center mt-8">
            <Link to="/shop" className="btn-outline">All Collections</Link>
          </div>
        </div>
      </section>

      {/* ── BRAND STORY ── */}
      <section className="w-full px-2 md:px-6 py-10 grid md:grid-cols-2 gap-12 items-center">
        <div className="relative">
          <img src="https://picsum.photos/seed/tanya/500/600" alt="Founder" className="w-full max-h-[500px] object-cover" />
          <div className="absolute bottom-4 left-4 bg-white border border-pinkborder px-5 py-3 shadow-sm">
            <p className="font-serif font-bold text-darktext text-lg">Est. 2018</p>
            <p className="text-xs text-gray-500">New Delhi, India</p>
          </div>
        </div>
        <div>
          <p className="section-label">Our Story</p>
          <h2 className="section-title mb-5 leading-snug">Crafted with Love,<br />Worn with Pride</h2>
          <p className="text-gray-500 leading-relaxed mb-4 text-sm">
            Kavipushp was born from a simple dream — to make every Indian bride feel like a queen without compromising on quality or breaking the bank. Founded by Tanya in 2018, we started as a small boutique in Delhi and have since dressed over 5,000 brides across India.
          </p>
          <p className="text-gray-500 leading-relaxed mb-6 text-sm">
            Every piece is handpicked or handcrafted by skilled artisans. From the intricate zari embroidery on our lehengas to the hand-set kundan stones on our jewellery — quality is never an afterthought.
          </p>
          <Link to="/about" className="btn-outline">Read Our Story</Link>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="bg-white border-t border-gray-100 py-10">
        <div className="w-full px-2 md:px-6">
          <div className="text-center mb-10">
            <p className="section-label">Love Stories</p>
            <h2 className="section-title">What Our Brides Say</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div key={i} className="bg-rose-50 border border-pinkborder p-6">
                <Stars n={t.rating} />
                <p className="text-gray-600 text-sm leading-relaxed mt-3 mb-4 italic">"{t.text}"</p>
                <p className="font-semibold text-darktext text-sm">{t.name}</p>
                <p className="text-xs text-gray-400">{t.location}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INSTAGRAM GALLERY ── */}
      <section className="py-10">
        <div className="text-center mb-8">
          <p className="section-label">@kavipushp</p>
          <h2 className="section-title">Follow Our Journey</h2>
          <p className="text-gray-400 text-sm mt-2">Tag us on Instagram to be featured!</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
          {galleryImages.map((src, i) => (
            <a key={i} href="https://instagram.com/kavipushp" target="_blank" rel="noreferrer" className="group relative overflow-hidden aspect-square">
              <img src={src} alt="Gallery" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-rose-600/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
              </div>
            </a>
          ))}
        </div>
      </section>

    </div>
  );
}
