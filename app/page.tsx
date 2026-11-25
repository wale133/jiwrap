
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Headphones,
  Menu,
  PackageCheck,
  Search,
  ShoppingBag,
  ShoppingCart,
  Truck,
  X,
  Printer,
  Layers3,
  Instagram,
  Facebook,
  Linkedin,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/client';

type Category = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  unit: string;
  image: string;
  tag?: string;
};

const naira = (value: number) =>
  `₦${value.toLocaleString('en-NG')}`;

export default function Home() {
  const [cartCount, setCartCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [heroVideo, setHeroVideo] = useState('');
  const [heroVideoReady, setHeroVideoReady] = useState(false);

  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const heroPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Load products and categories from Supabase.
  useEffect(() => {
    let isMounted = true;

    async function loadStorefront() {
      const supabase = createClient();

      let loadingStage = 'categories';

      try {
        setLoadingProducts(true);
        setLoadError('');

        loadingStage = 'categories';

        const { data: categoryData, error: categoryError } =
          await supabase
            .from('categories')
            .select('id, name, description, image_url')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (categoryError) {
          throw categoryError;
        }

        loadingStage = 'products';

        const { data: productData, error: productError } =
          await supabase
            .from('products')
            .select(
              'id, name, category_id, price, short_description, is_featured'
            )
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (productError) {
          throw productError;
        }

        const productIds = (productData || []).map(
          (product) => product.id
        );

        let imageData: {
          product_id: string;
          image_url: string;
          is_primary: boolean;
          sort_order: number;
        }[] = [];

        if (productIds.length > 0) {
          loadingStage = 'product_images';

          const { data, error: imageError } = await supabase
            .from('product_images')
            .select(
              'product_id, image_url, is_primary, sort_order'
            )
            .in('product_id', productIds)
            .order('is_primary', { ascending: false })
            .order('sort_order', { ascending: true });

          if (imageError) {
            throw imageError;
          }

          imageData = data || [];
        }

        const categoryMap = new Map(
          (categoryData || []).map((category) => [
            category.id,
            category.name,
          ])
        );

        const mappedProducts: Product[] = (productData || []).map(
          (product) => {
            const productImage = imageData.find(
              (image) => image.product_id === product.id
            );

            const categoryName =
              categoryMap.get(product.category_id) || 'Other';

            return {
              id: product.id,
              name: product.name,
              category: categoryName,
              price: Number(product.price),
              unit: 'Custom order',
              image:
                productImage?.image_url ||
                'https://images.unsplash.com/photo-1607082349566-187342175e2f?auto=format&fit=crop&w=900&q=85',
              tag: product.is_featured ? 'Featured' : undefined,
            };
          }
        );

        if (isMounted) {
          setCategories(categoryData || []);
          setProducts(mappedProducts);
        }
      } catch (error) {
        console.error('Storefront loading error:', {
          stage: loadingStage,
          error,
        });

        const errorDetails =
          error && typeof error === 'object'
            ? (error as {
                message?: string;
                code?: string;
                details?: string;
                hint?: string;
              })
            : null;

        const errorMessage =
          errorDetails?.message ||
          (error instanceof Error
            ? error.message
            : String(error || 'Unknown error'));

        const diagnosticMessage = [
          errorMessage,
          errorDetails?.code,
          errorDetails?.details,
          errorDetails?.hint,
        ]
          .filter(Boolean)
          .join(' | ');

        if (isMounted) {
          setLoadError(`${loadingStage}: ${diagnosticMessage}`);
        }
      } finally {
        if (isMounted) {
          setLoadingProducts(false);
        }
      }
    }

    loadStorefront();

    return () => {
      isMounted = false;
    };
  }, []);

  // Load the homepage hero video configured from the admin dashboard.
  useEffect(() => {
    let isMounted = true;

    async function loadHeroVideo() {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('site_content')
        .select('content')
        .eq('section_key', 'hero_video')
        .maybeSingle();

      if (error) {
        console.error('Hero video loading error:', error);
        return;
      }

      const content = data?.content as
        | { video_url?: string | null }
        | null
        | undefined;

      if (isMounted) {
        if (heroPlayTimerRef.current) {
          clearTimeout(heroPlayTimerRef.current);
          heroPlayTimerRef.current = null;
        }

        setHeroVideoReady(false);
        setHeroVideo(content?.video_url || '');
      }
    }

    loadHeroVideo();

    return () => {
      isMounted = false;

      if (heroPlayTimerRef.current) {
        clearTimeout(heroPlayTimerRef.current);
      }
    };
  }, []);

  // Show the video's first frame, then start playback after 500ms.
  const handleHeroVideoLoaded = () => {
    const video = heroVideoRef.current;

    if (!video) return;

    video.muted = true;

    // Reveal the actual first frame before playback starts.
    setHeroVideoReady(true);

    if (heroPlayTimerRef.current) {
      clearTimeout(heroPlayTimerRef.current);
    }

    heroPlayTimerRef.current = setTimeout(() => {
      video.play().catch((error) => {
        console.warn(
          'Jiwrap hero autoplay was blocked by the browser:',
          error
        );
      });
    }, 500);
  };

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (activeCategory === 'All' ||
            product.category === activeCategory) &&
          product.name.toLowerCase().includes(search.toLowerCase())
      ),
    [activeCategory, search, products]
  );

  return (
    <main>
      <div className="announcement">
        <div className="announcement-inner">
          <span>
            <Truck size={15} /> Custom printing & packaging. Delivered
            across Nigeria.
          </span>
          <div>
            <a href="#track">Track order</a>
            <i />
            <a href="#help">Help centre</a>
          </div>
        </div>
      </div>

      <header className="site-header">
        <div className="nav-inner">
          {/* OFFICIAL JIWRAP HEADER LOGO */}
          <a
            className="wordmark"
            href="#home"
            aria-label="Jiwrap home"
          >
            <img
              src="/jiwrap-logo.png"
              alt="Jiwrap"
              style={{
                display: 'block',
                width: '145px',
                height: 'auto',
              }}
            />
          </a>

          <nav className={menuOpen ? 'main-nav open' : 'main-nav'}>
            <a
              className="nav-active"
              href="#home"
              onClick={() => setMenuOpen(false)}
            >
              Home
            </a>

            <a href="#shop" onClick={() => setMenuOpen(false)}>
              Shop <ChevronDown size={14} />
            </a>

            <a href="#shop" onClick={() => setMenuOpen(false)}>
              Packaging <ChevronDown size={14} />
            </a>

            <a href="#shop" onClick={() => setMenuOpen(false)}>
              Printing <ChevronDown size={14} />
            </a>

            <a href="#corporate" onClick={() => setMenuOpen(false)}>
              Corporate gifts
            </a>

            <a href="#help" onClick={() => setMenuOpen(false)}>
              Contact
            </a>
          </nav>

          <div className="nav-actions">
            <button
              className="icon-button search-trigger"
              aria-label="Search products"
              onClick={() => setSearchOpen(!searchOpen)}
            >
              <Search size={20} />
            </button>

            <a
              className="icon-button account-link"
              href="#account"
              aria-label="My account"
            >
              <span className="user-outline">♙</span>
            </a>

            <a
              className="cart-link"
              href="#shop"
              aria-label={`Cart with ${cartCount} items`}
            >
              <ShoppingBag size={20} />
              <span className="cart-count">{cartCount}</span>
            </a>

            <button
              className="mobile-menu"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="search-panel">
            <Search size={18} />
            <input
              autoFocus
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                document
                  .getElementById('shop')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <button
              onClick={() => {
                setSearch('');
                setSearchOpen(false);
              }}
            >
              <X size={18} />
            </button>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="hero" id="home">
        <div className="hero-copy">
          <div className="eyebrow">
            <span>PRINTING</span>
            <b>•</b>
            <span>PACKAGING</span>
            <b>•</b>
            <span>BRANDED ESSENTIALS</span>
          </div>

          <h1>
            Make your brand
            <br />
            <em>impossible to</em>
            <br />
            overlook.
          </h1>

          <p>
            Custom printing, packaging and branded essentials made for
            businesses ready to stand out.
          </p>

          <div className="hero-buttons">
            <a className="button button-primary" href="#shop">
              Explore products <ArrowRight size={18} />
            </a>

            <a className="button button-outline" href="#custom">
              Request a quote
            </a>
          </div>

          <div className="hero-proof">
            <span>
              <Check size={15} /> Quality finishing
            </span>
            <span>
              <PackageCheck size={15} /> Made for your brand
            </span>
            <span>
              <Truck size={16} /> Nationwide delivery
            </span>
          </div>
        </div>

        {/* HERO VIDEO: loaded from Admin > Website Management */}
        <div
          className="hero-visual"
          style={{ position: 'relative' }}
        >
          {/* Original Jiwrap artwork remains underneath as a fallback. */}
          <div className="hero-visual-glow" />

          <div className="hero-stamp">
            MADE TO
            <br />
            MAKE AN
            <br />
            <strong>IMPRESSION.</strong>
          </div>

          <div className="hero-product hero-bag">
            <div className="bag-handle" />
            <span>jiwrap</span>
          </div>

          <div className="hero-product hero-box">
            <span>jiwrap.</span>
          </div>

          <div className="hero-product hero-mailer">
            <span>
              YOUR BRAND
              <br />
              GOES HERE
            </span>
          </div>

          <div className="hero-product hero-card">
            <span>J</span>
            <small>BRAND ESSENTIALS</small>
          </div>

          <div className="hero-roll">
            <span>J</span>
            <span>J</span>
            <span>J</span>
          </div>

          {/* Video first frame appears before playback begins. */}
          {heroVideo && (
            <video
              ref={heroVideoRef}
              key={heroVideo}
              className="hero-background-video"
              src={heroVideo}
              muted
              loop
              playsInline
              preload="auto"
              controls={false}
              disablePictureInPicture
              disableRemotePlayback
              onLoadedData={handleHeroVideoLoaded}
              onError={() => {
                setHeroVideoReady(false);

                if (heroPlayTimerRef.current) {
                  clearTimeout(heroPlayTimerRef.current);
                  heroPlayTimerRef.current = null;
                }

                console.error('Jiwrap hero video failed to load.');
              }}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: 'inherit',
                opacity: heroVideoReady ? 1 : 0,
                transition: 'opacity 300ms ease',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="section wrap" id="shop">
        <div className="section-heading products-heading">
          <div>
            <span className="section-kicker">CUSTOMER FAVOURITES</span>
            <h2>
              Featured products<span>.</span>
            </h2>
          </div>

          <a className="text-link" href="#shop">
            Explore the shop <ArrowUpRight size={18} />
          </a>
        </div>

        <div className="filter-row">
          <div className="filter-pills">
            {[
              'All',
              ...categories.map((category) => category.name),
            ].map((name) => (
              <button
                key={name}
                className={
                  activeCategory === name
                    ? 'filter-pill active'
                    : 'filter-pill'
                }
                onClick={() => setActiveCategory(name)}
              >
                {name}
              </button>
            ))}
          </div>

          <div className="product-search">
            <Search size={16} />
            <input
              aria-label="Filter products"
              placeholder="Find a product"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loadingProducts && (
          <div className="empty-state">Loading products...</div>
        )}

        {!loadingProducts && loadError && (
          <div className="empty-state">
            Unable to load products: {loadError}
          </div>
        )}

        {!loadingProducts && !loadError && (
          <>
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <article className="product-card" key={product.id}>
                  <a
                    href="#custom"
                    className="product-image"
                    style={{
                      backgroundImage: `url(${product.image})`,
                    }}
                  >
                    {product.tag && (
                      <span className="product-tag">{product.tag}</span>
                    )}

                    <span className="quick-view">
                      View details <ArrowUpRight size={15} />
                    </span>
                  </a>

                  <div className="product-info">
                    <span className="product-category">
                      {product.category}
                    </span>

                    <h3>{product.name}</h3>

                    <div className="product-bottom">
                      <div>
                        <strong>From {naira(product.price)}</strong>
                        <small>{product.unit}</small>
                      </div>

                      <button
                        className="add-button"
                        onClick={() => setCartCount(cartCount + 1)}
                        aria-label={`Add ${product.name} to cart`}
                      >
                        <ShoppingCart size={16} />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="empty-state">
                No products match that search. Try another name or category.
              </div>
            )}
          </>
        )}
      </section>

      {/* CUSTOM ORDER CTA */}
      <section className="custom-cta wrap" id="custom">
        <div className="custom-cta-copy">
          <span className="section-kicker light">
            HAVE A PROJECT IN MIND?
          </span>

          <h2>
            Let’s make
            <br />
            <em>something memorable.</em>
          </h2>

          <p>
            Need a custom size, special finish or a complete packaging
            solution? Tell us what you have in mind.
          </p>

          <a
            className="button button-orange"
            href="https://wa.me/2340000000000?text=Hello%20Jiwrap%2C%20I%20would%20like%20a%20custom%20printing%20or%20packaging%20quote."
            target="_blank"
            rel="noreferrer"
          >
            Start a custom order <ArrowRight size={18} />
          </a>

          {/* BENEFITS MOVED INTO CUSTOM ORDER SECTION */}
          <div className="custom-benefits">
            <div className="benefit">
              <span className="benefit-icon">
                <Printer />
              </span>
              <div>
                <strong>Quality printing</strong>
                <small>Sharp details. Clean finishing.</small>
              </div>
            </div>

            <div className="benefit">
              <span className="benefit-icon">
                <Layers3 />
              </span>
              <div>
                <strong>Made for your brand</strong>
                <small>Custom sizes, colours and finishes.</small>
              </div>
            </div>

            <div className="benefit">
              <span className="benefit-icon">
                <Truck />
              </span>
              <div>
                <strong>Delivery across Nigeria</strong>
                <small>Get your orders where you need them.</small>
              </div>
            </div>

            <div className="benefit">
              <span className="benefit-icon">
                <Headphones />
              </span>
              <div>
                <strong>Here to help</strong>
                <small>Support from enquiry to delivery.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="custom-cta-art">
          <div className="cta-paper cta-paper-back" />

          <div className="cta-paper cta-paper-front">
            <span>
              YOUR
              <br />
              IDEA.
            </span>
            <b>OUR PRINT.</b>
          </div>

          <div className="cta-seal">J</div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className="trust-strip wrap">
        <span>MADE FOR BUSINESSES THAT CARE ABOUT THE DETAILS</span>

        <div className="trust-words">
          <b>RETAIL</b>
          <i />
          <b>HOSPITALITY</b>
          <i />
          <b>BEAUTY</b>
          <i />
          <b>FOOD & DRINK</b>
          <i />
          <b>CORPORATE</b>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer" id="help">
        <div className="footer-main wrap">
          <div className="footer-brand">
            {/* OFFICIAL JIWRAP FOOTER LOGO */}
            <a
              className="wordmark footer-wordmark"
              href="#home"
              aria-label="Jiwrap home"
            >
              <img
                src="/jiwrap-logo.png"
                alt="Jiwrap"
                style={{
                  display: 'block',
                  width: '165px',
                  height: 'auto',
                }}
              />
            </a>

            <p>
              Custom printing, packaging and branded essentials for
              businesses with something to say.
            </p>

            <div className="socials">
              <a href="#instagram" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a href="#facebook" aria-label="Facebook">
                <Facebook size={18} />
              </a>
              <a href="#linkedin" aria-label="LinkedIn">
                <Linkedin size={18} />
              </a>
            </div>
          </div>

          <div className="footer-column">
            <h4>Explore</h4>
            <a href="#shop">All products</a>
            <a href="#shop">Packaging</a>
            <a href="#shop">Printing</a>
            <a href="#corporate">Corporate gifts</a>
          </div>

          <div className="footer-column">
            <h4>Company</h4>
            <a href="#help">Contact Jiwrap</a>
            <a href="#custom">Custom orders</a>
            <a href="#contact">Contact us</a>
            <a href="#faq">FAQs</a>
          </div>

          <div className="footer-column">
            <h4>Customer care</h4>
            <a href="#track">Track an order</a>
            <a href="#delivery">Delivery information</a>
            <a href="#returns">Returns</a>
            <a href="#help">Help centre</a>
          </div>

          <div className="footer-news">
            <h4>Let’s keep in touch.</h4>
            <p>Get product updates, print ideas and occasional offers.</p>

            <form onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="Your email address"
                aria-label="Your email address"
              />
              <button aria-label="Subscribe">
                <ArrowRight size={18} />
              </button>
            </form>

            <small>
              Newsletter sign-up will be connected in a later phase.
            </small>
          </div>
        </div>

        <div className="footer-bottom wrap">
          <span>
            © {new Date().getFullYear()} Jiwrap. All rights reserved.
          </span>
          <span>Made for brands that make an impression.</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </main>
  );
}
