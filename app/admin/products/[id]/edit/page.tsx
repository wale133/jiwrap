
"use client";

import { useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "../../../../../lib/supabase/client";

type Category = {
  id: string;
  name: string;
};

type ExistingImage = {
  id: string;
  object_key: string;
  image_url: string;
  alt_text: string | null;
  sort_order: number;
  is_primary: boolean;
};

type NewImage = {
  id: string;
  file: File;
  preview: string;
};

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [status, setStatus] = useState("draft");
  const [featured, setFeatured] = useState(false);

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [removedImages, setRemovedImages] = useState<ExistingImage[]>([]);
  const [mainImageId, setMainImageId] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProduct() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !admin || !admin.is_active || admin.role !== "admin") {
        router.replace("/admin/login");
        return;
      }

      const { data: categoryData, error: categoryError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (categoryError) {
        setError("Unable to load categories: " + categoryError.message);
        setLoading(false);
        return;
      }

      setCategories(categoryData || []);

      const { data: product, error: productError } = await supabase
        .from("products")
        .select(
          "id, category_id, name, slug, short_description, full_description, price, sale_price, status, is_featured"
        )
        .eq("id", productId)
        .single();

      if (productError || !product) {
        setError(productError?.message || "Product not found.");
        setLoading(false);
        return;
      }

      setCategoryId(product.category_id || "");
      setName(product.name || "");
      setSlug(product.slug || "");
      setShortDescription(product.short_description || "");
      setDescription(product.full_description || "");
      setPrice(String(product.price ?? ""));
      setSalePrice(
        product.sale_price === null ? "" : String(product.sale_price)
      );
      setStatus(product.status || "draft");
      setFeatured(Boolean(product.is_featured));

      const { data: imageData, error: imageError } = await supabase
        .from("product_images")
        .select("id, object_key, image_url, alt_text, sort_order, is_primary")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true });

      if (imageError) {
        setError("Unable to load product images: " + imageError.message);
        setLoading(false);
        return;
      }

      const savedImages = (imageData || []) as ExistingImage[];
      setExistingImages(savedImages);

      const primaryImage = savedImages.find((image) => image.is_primary);
      if (primaryImage) setMainImageId(primaryImage.id);

      setLoading(false);
    }

    loadProduct();
  }, [productId, router]);

  function updateName(value: string) {
    setName(value);
    setSlug(
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
    );
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    const files = Array.from(event.target.files || []);
    const total = existingImages.length + newImages.length + files.length;

    if (total > MAX_IMAGES) {
      setError(`You can have a maximum of ${MAX_IMAGES} images.`);
      event.target.value = "";
      return;
    }

    const validImages: NewImage[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Only JPG, PNG, WebP and AVIF images are allowed.");
        continue;
      }

      if (file.size === 0 || file.size > MAX_FILE_SIZE) {
        setError("Each image must be smaller than 10MB.");
        continue;
      }

      validImages.push({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (validImages.length) {
      setNewImages((current) => {
        const updated = [...current, ...validImages];

        if (!mainImageId && existingImages.length === 0) {
          setMainImageId(updated[0].id);
        }

        return updated;
      });
    }

    event.target.value = "";
  }

  function removeExistingImage(image: ExistingImage) {
    setExistingImages((current) =>
      current.filter((item) => item.id !== image.id)
    );
    setRemovedImages((current) => [...current, image]);

    if (mainImageId === image.id) {
      setMainImageId(newImages[0]?.id || "");
    }
  }

  function removeNewImage(image: NewImage) {
    URL.revokeObjectURL(image.preview);

    const remaining = newImages.filter((item) => item.id !== image.id);
    setNewImages(remaining);

    if (mainImageId === image.id) {
      setMainImageId(existingImages[0]?.id || remaining[0]?.id || "");
    }
  }

  async function uploadNewImages() {
    const uploaded: {
      object_key: string;
      image_url: string;
      alt_text: string;
      sort_order: number;
      is_primary: boolean;
    }[] = [];

    for (let index = 0; index < newImages.length; index++) {
      const image = newImages[index];

      const prepareResponse = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: image.file.type,
          size: image.file.size,
          folder: "products",
        }),
      });

      const uploadData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(uploadData.error || "Could not prepare image upload.");
      }

      const fileResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": image.file.type },
        body: image.file,
      });

      if (!fileResponse.ok) {
        throw new Error(`Could not upload ${image.file.name}.`);
      }

      uploaded.push({
        object_key: uploadData.objectKey,
        image_url: uploadData.publicUrl,
        alt_text: name.trim(),
        sort_order: existingImages.length + index,
        is_primary: mainImageId === image.id,
      });
    }

    return uploaded;
  }

  async function deleteR2File(objectKey: string) {
    try {
      await fetch("/api/upload", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey }),
      });
    } catch (deleteError) {
      console.error("Could not delete old image:", deleteError);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!categoryId) {
      setError("Please select a product category.");
      return;
    }

    if (!name.trim() || !slug.trim()) {
      setError("Please enter a product name and URL slug.");
      return;
    }

    if (!price || Number(price) <= 0) {
      setError("Please enter a valid product price.");
      return;
    }

    if (salePrice && Number(salePrice) < 0) {
      setError("Sale price cannot be negative.");
      return;
    }

    if (salePrice && Number(salePrice) > Number(price)) {
      setError("Sale price cannot be higher than the regular price.");
      return;
    }

    if (
      existingImages.length + newImages.length > 0 &&
      !mainImageId
    ) {
      setError("Please choose a main product image.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    let uploadedFiles: string[] = [];

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("role, is_active")
        .eq("user_id", user.id)
        .maybeSingle();

      if (adminError || !admin || !admin.is_active || admin.role !== "admin") {
        throw new Error("You are not authorised to edit products.");
      }

      const uploaded = await uploadNewImages();
      uploadedFiles = uploaded.map((image) => image.object_key);

      const { error: updateError } = await supabase
        .from("products")
        .update({
          category_id: categoryId,
          name: name.trim(),
          slug: slug.trim(),
          short_description: shortDescription.trim() || null,
          full_description: description.trim() || null,
          price: Number(price),
          sale_price: salePrice ? Number(salePrice) : null,
          status,
          is_featured: featured,
        })
        .eq("id", productId);

      if (updateError) throw new Error(updateError.message);

      for (let index = 0; index < existingImages.length; index++) {
        const image = existingImages[index];

        const { error: imageUpdateError } = await supabase
          .from("product_images")
          .update({
            is_primary: mainImageId === image.id,
            sort_order: index,
            alt_text: name.trim(),
          })
          .eq("id", image.id);

        if (imageUpdateError) throw new Error(imageUpdateError.message);
      }

      if (uploaded.length > 0) {
        const records = uploaded.map((image, index) => ({
          product_id: productId,
          ...image,
          sort_order: existingImages.length + index,
        }));

        const { error: imageInsertError } = await supabase
          .from("product_images")
          .insert(records);

        if (imageInsertError) throw new Error(imageInsertError.message);
      }

      if (removedImages.length > 0) {
        const { error: deleteRecordsError } = await supabase
          .from("product_images")
          .delete()
          .in(
            "id",
            removedImages.map((image) => image.id)
          );

        if (deleteRecordsError) {
          throw new Error(
            "Product updated, but removed image records could not be deleted: " +
              deleteRecordsError.message
          );
        }

        for (const image of removedImages) {
          await deleteR2File(image.object_key);
        }
      }

      newImages.forEach((image) => URL.revokeObjectURL(image.preview));

      router.replace("/admin/products");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while updating the product.";

      setError(message);

      if (uploadedFiles.length > 0) {
        console.error(
          "New images were uploaded. Check their records before retrying:",
          uploadedFiles
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-layout">
        <div className="admin-main">
          <section className="admin-products">
            <p>Loading product...</p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Jiwrap Admin</h2>
        <nav>
          <a href="/admin/dashboard">Dashboard Overview</a>
          <a href="/admin/products" className="active">
            Product Management
          </a>
          <a href="/admin/categories">Categories</a>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Edit Product</h1>
          <span>Jiwrap Administrator</span>
        </header>

        <section className="admin-products">
          <div className="admin-products-header">
            <div>
              <h2>Product Details</h2>
              <p>Update your product information and images.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="product-form">
            <div className="product-form-section">
              <h3>Basic Information</h3>

              <label>Product Name *</label>
              <input
                required
                value={name}
                onChange={(event) => updateName(event.target.value)}
                placeholder="Product name"
              />

              <label>Product URL / Slug *</label>
              <input
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />

              <label>Product Category *</label>
              <select
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>

              <label>Short Description</label>
              <textarea
                rows={3}
                value={shortDescription}
                onChange={(event) => setShortDescription(event.target.value)}
              />

              <label>Full Description</label>
              <textarea
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            <div className="product-form-section">
              <h3>Product Images</h3>
              <p>
                Keep, remove or add images. Maximum {MAX_IMAGES} images and
                10MB per image.
              </p>

              <label className="product-image-upload">
                <span>+ Add Product Images</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  onChange={handleImageSelection}
                  disabled={
                    saving ||
                    existingImages.length + newImages.length >= MAX_IMAGES
                  }
                />
              </label>

              <div className="product-image-grid">
                {existingImages.map((image) => (
                  <div
                    className={`product-image-card ${
                      mainImageId === image.id ? "main-image" : ""
                    }`}
                    key={image.id}
                  >
                    <img src={image.image_url} alt={image.alt_text || name} />

                    {mainImageId === image.id && (
                      <span className="main-image-label">Main Image</span>
                    )}

                    <div className="product-image-actions">
                      {mainImageId !== image.id && (
                        <button
                          type="button"
                          onClick={() => setMainImageId(image.id)}
                          disabled={saving}
                        >
                          Set as Main
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeExistingImage(image)}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}

                {newImages.map((image) => (
                  <div
                    className={`product-image-card ${
                      mainImageId === image.id ? "main-image" : ""
                    }`}
                    key={image.id}
                  >
                    <img src={image.preview} alt={image.file.name} />

                    {mainImageId === image.id && (
                      <span className="main-image-label">Main Image</span>
                    )}

                    <div className="product-image-actions">
                      {mainImageId !== image.id && (
                        <button
                          type="button"
                          onClick={() => setMainImageId(image.id)}
                          disabled={saving}
                        >
                          Set as Main
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => removeNewImage(image)}
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>

                    <small>{image.file.name}</small>
                  </div>
                ))}
              </div>

              <p>
                {existingImages.length + newImages.length} of {MAX_IMAGES}{" "}
                images selected.
              </p>
            </div>

            <div className="product-form-section">
              <h3>Pricing</h3>

              <div className="product-form-two-columns">
                <div>
                  <label>Regular Price (₦) *</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                  />
                </div>

                <div>
                  <label>Sale Price (₦)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(event) => setSalePrice(event.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="product-form-section">
              <h3>Publishing</h3>

              <label>Product Status</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="unpublished">Unpublished</option>
              </select>

              <label className="product-featured-option">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(event) => setFeatured(event.target.checked)}
                />
                Feature this product on the website
              </label>
            </div>

            {error && (
              <p className="category-message error" role="alert">
                {error}
              </p>
            )}

            <div className="product-form-actions">
              <a href="/admin/products" className="product-cancel-button">
                Cancel
              </a>

              <button
                type="submit"
                className="admin-primary-button"
                disabled={saving}
              >
                {saving ? "Updating Product..." : "Save Changes"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
