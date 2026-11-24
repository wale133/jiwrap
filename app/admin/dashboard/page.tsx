
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin/login");
  }

  const { data: admin, error: adminError } = await supabase
    .from("admin_users")
    .select("full_name, role, is_active")
    .eq("user_id", user.id)
    .single();

  if (
    adminError ||
    !admin ||
    !admin.is_active ||
    admin.role !== "admin"
  ) {
    redirect("/admin/login");
  }

  const { count: totalProducts } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true });

  const { count: publishedProducts } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Jiwrap Admin</h2>

        <nav>
          <Link
            href="/admin/dashboard"
            className="active"
          >
            Dashboard Overview
          </Link>

          <Link href="/admin/hero-video">
            Website Management
          </Link>

          <Link href="/admin/products">
            Product Management
          </Link>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Dashboard Overview</h1>

          <span>
            {admin.full_name || "Administrator"}
          </span>
        </header>

        <section className="admin-content">
          <h2>
            Welcome back, {admin.full_name || "Administrator"}
          </h2>

          <p className="admin-subtitle">
            Here's an overview of your Jiwrap website.
          </p>

          <div className="admin-stats">
            <div className="admin-stat-card">
              <h3>Total Products</h3>
              <strong>{totalProducts ?? 0}</strong>
            </div>

            <div className="admin-stat-card">
              <h3>Published Products</h3>
              <strong>{publishedProducts ?? 0}</strong>
            </div>
          </div>

          <div className="admin-section-grid">
            <Link
              href="/admin/dashboard"
              className="admin-section-card"
            >
              <h3>Dashboard Overview</h3>

              <p>
                Monitor your website's product catalogue.
              </p>
            </Link>

            <Link
              href="/admin/hero-video"
              className="admin-section-card"
              id="website-management"
            >
              <h3>Website Management</h3>

              <p>
                Manage homepage content, hero videos and
                website sections.
              </p>

              <span>Manage website →</span>
            </Link>

            <Link
              href="/admin/products"
              className="admin-section-card"
            >
              <h3>Product Management</h3>

              <p>
                Add, edit, organise and publish your products.
              </p>
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
