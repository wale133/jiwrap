
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  sale_price: number | null;
  status: "draft" | "published" | "unpublished" | string;
  is_featured: boolean;
  created_at: string;
};

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProducts() {
      const supabase = createClient();

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/admin/login");
          return;
        }

        const { data: admin, error: adminError } = await supabase
          .from("admin_users")
          .select("role, is_active")
          .eq("user_id", user.id)
          .maybeSingle();

        if (
          adminError ||
          !admin ||
          !admin.is_active ||
          admin.role !== "admin"
        ) {
          router.replace("/admin/login");
          return;
        }

        const { data, error: productsError } = await supabase
          .from("products")
          .select(
            "id, name, slug, price, sale_price, status, is_featured, created_at"
          )
          .order("created_at", { ascending: false });

        if (productsError) {
          throw new Error(productsError.message);
        }

        if (active) {
          setProducts(data || []);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load products."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      active = false;
    };
  }, [router]);

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      maximumFractionDigits: 2,
    }).format(Number(amount) || 0);

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Jiwrap Admin</h2>
        <nav>
          <Link href="/admin/dashboard">Dashboard Overview</Link>
          <Link href="/admin/dashboard#website-management">
            Website Management
          </Link>
          <Link href="/admin/products" className="active">
            Product Management
          </Link>
          <Link href="/admin/categories">Categories</Link>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Product Management</h1>
          <span>Jiwrap Administrator</span>
        </header>

        <section className="admin-products">
          <div className="admin-products-header">
            <div>
              <h2>Your Products</h2>
              <p>Manage the products in your Jiwrap catalogue.</p>
            </div>
            <Link href="/admin/products/new" className="admin-primary-button">
              + Add New Product
            </Link>
          </div>

          <div className="product-list-summary">
            <span>Total Products</span>
            <strong>{loading ? "…" : products.length}</strong>
          </div>

          {error && (
            <p className="category-message error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <p>Loading products...</p>
          ) : error ? null : products.length === 0 ? (
            <div className="product-empty-state">
              <h3>No products yet</h3>
              <p>Add your first product to start building your catalogue.</p>
              <Link
                href="/admin/products/new"
                className="admin-primary-button"
              >
                Add Your First Product
              </Link>
            </div>
          ) : (
            <div className="product-table-wrapper">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>{product.name}</strong>
                        <small>/{product.slug}</small>
                      </td>
                      <td>
                        {product.sale_price
                          ? formatPrice(product.sale_price)
                          : formatPrice(product.price)}
                        {product.sale_price ? (
                          <small className="product-regular-price">
                            {formatPrice(product.price)}
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <span
                          className={`product-status product-status-${product.status}`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td>{product.is_featured ? "Yes" : "No"}</td>
                      <td>
                        <Link
                          href={`/admin/products/${product.id}/edit`}
                          className="admin-primary-button"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
