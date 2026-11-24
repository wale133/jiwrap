
"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadCategories() {
    setLoading(true);
    setError("");

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/admin/login";
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from("admin_users")
      .select("role, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !admin || !admin.is_active || admin.role !== "admin") {
      window.location.href = "/admin/login";
      return;
    }

    const { data, error: categoryError } = await supabase
      .from("categories")
      .select("id, name, slug, description, image_url, is_active, sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (categoryError) {
      setError(categoryError.message);
    } else {
      setCategories(data || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function updateName(value: string) {
    setName(value);
    setSlug(
      value.toLowerCase().trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    const supabase = createClient();

    const { error: insertError } = await supabase
      .from("categories")
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        sort_order: Number(sortOrder) || 0,
        is_active: true,
      });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setName("");
    setSlug("");
    setDescription("");
    setSortOrder("0");
    setSuccess("Category created successfully.");

    await loadCategories();
    setSaving(false);
  }

  async function toggleCategory(category: Category) {
    const supabase = createClient();
    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSuccess("Category status updated.");
    await loadCategories();
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Jiwrap Admin</h2>
        <nav>
          <Link href="/admin/dashboard">Dashboard Overview</Link>
          <Link href="/admin/dashboard#website-management">
            Website Management
          </Link>
          <Link href="/admin/products">Product Management</Link>
          <Link href="/admin/categories" className="active">
            Categories
          </Link>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Category Management</h1>
          <span>Jiwrap Administrator</span>
        </header>

        <section className="admin-products">
          <div className="admin-products-header">
            <div>
              <h2>Product Categories</h2>
              <p>Create and organise your product categories.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="product-form">
            <div className="product-form-section">
              <h3>Create New Category</h3>

              <label>Category Name *</label>
              <input
                required
                value={name}
                onChange={(event) => updateName(event.target.value)}
                placeholder="e.g. Shopping Bags"
              />

              <label>Category URL / Slug *</label>
              <input
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="shopping-bags"
              />

              <label>Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe this category"
              />

              <label>Display Order</label>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
              />

              <button
                type="submit"
                className="admin-primary-button"
                disabled={saving}
              >
                {saving ? "Saving..." : "Create Category"}
              </button>
            </div>
          </form>

          {error && <p className="category-message error">{error}</p>}
          {success && <p className="category-message success">{success}</p>}

          <div className="product-form-section" style={{ marginTop: 25 }}>
            <h3>Existing Categories</h3>

            {loading ? (
              <p>Loading categories...</p>
            ) : categories.length === 0 ? (
              <p>No categories created yet.</p>
            ) : (
              <div className="admin-products-table-wrapper">
                <table className="admin-products-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Slug</th>
                      <th>Display Order</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td>
                          <strong>{category.name}</strong>
                          <br />
                          <small>{category.description || "No description"}</small>
                        </td>
                        <td>{category.slug}</td>
                        <td>{category.sort_order}</td>
                        <td>
                          <span className="admin-product-status">
                            {category.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className="category-toggle-button"
                          >
                            {category.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
