
"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../../../lib/supabase/client";

type Category = {
  id: string;
  name: string;
};

type SelectedImage = {
  id: string;
  file: File;
  preview: string;
};

type UploadedImage = {
  objectKey: string;
  publicUrl: string;
  altText: string;
  sortOrder: number;
  isPrimary: boolean;
};

const MAX_IMAGES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

export default function NewProductPage() {
  const router = useRouter();

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

  const [images, setImages] = useState<SelectedImage[]>([]);
  const [mainImageId, setMainImageId] = useState("");

  const [loading, setLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function initialisePage() {
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

      if (
        adminError ||
        !admin ||
        !admin.is_active ||
        admin.role !== "admin"
      ) {
        router.replace("/admin/login");
        return;
      }

      const { data, error: categoryError } = await supabase
        .from("categories")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (categoryError) {
        setError("Unable to load categories: " + categoryError.message);
      } else {
        setCategories(data || []);
      }

      setCategoriesLoading(false);
    }

    initialisePage();
  }, [router]);

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

    const selectedFiles = Array.from(event.target.files || []);

    if (images.length + selectedFiles.length > MAX_IMAGES) {
      setError(`You can select a maximum of ${MAX_IMAGES} images.`);
      event.target.value = "";
      return;
    }

    const validImages: SelectedImage[] = [];

    for (const file of selectedFiles) {
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

    if (validImages.length > 0) {
      setImages((current) => {
        const updated = [...current, ...validImages];

        if (!mainImageId && updated.length > 0) {
          setMainImageId(updated[0].id);
        }

        return updated;
      });
    }

    event.target.value = "";
  }

  function removeImage(imageId: string) {
    const imageToRemove = images.find((image) => image.id === imageId);

    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }

    const remaining = images.filter((image) => image.id !== imageId);

    setImages(remaining);

    if (mainImageId === imageId) {
      setMainImageId(remaining[0]?.id || "");
    }
  }

  async function uploadImages(): Promise<UploadedImage[]> {
    const uploaded: UploadedImage[] = [];

    for (let index = 0; index < images.length; index++) {
      const image = images[index];

      const prepareResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: image.file.type,
          size: image.file.size,
          folder: "products",
        }),
      });

      const uploadData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(
          uploadData.error || "Could not prepare image upload."
        );
      }

      const fileResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": image.file.type,
        },
        body: image.file,
      });

      if (!fileResponse.ok) {
        throw new Error(`Could not upload ${image.file.name}.`);
      }

      uploaded.push({
        objectKey: uploadData.objectKey,
        publicUrl: uploadData.publicUrl,
        altText: name.trim(),
        sortOrder: index,
        isPrimary: image.id === mainImageId,
      });
    }

    return uploaded;
  }

  async function deleteUploadedFiles(objectKeys: string[]) {
    for (const objectKey of objectKeys) {
      try {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ objectKey }),
        });
      } catch (cleanupError) {
        console.error("Image cleanup failed:", cleanupError);
      }
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

    if (images.length > 0 && !mainImageId) {
      setError("Please choose a main product image.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    let uploadedImages: UploadedImage[] = [];

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

      if (
        adminError ||
        !admin ||
        !admin.is_active ||
        admin.role !== "admin"
      ) {
        throw new Error("You are not authorised to add products.");
      }

      // Upload selected images to Cloudflare first.
      uploadedImages = await uploadImages();

      // Create the product in Supabase.
      const { data: product, error: insertError } = await supabase
        .from("products")
        .insert({
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
        .select("id")
        .single();

      if (insertError || !product) {
        throw new Error(
          insertError?.message || "Could not create the product."
        );
      }

      // Save image records linked to the new product.
      if (uploadedImages.length > 0) {
        const imageRecords = uploadedImages.map((image) => ({
          product_id: product.id,
          object_key: image.objectKey,
          image_url: image.publicUrl,
          alt_text: image.altText,
          sort_order: image.sortOrder,
          is_primary: image.isPrimary,
        }));

        const { error: imageInsertError } = await supabase
          .from("product_images")
          .insert(imageRecords);

        if (imageInsertError) {
          throw new Error(
            `The product was created, but its image records could not be saved: ${imageInsertError.message}. Do not submit this product again.`
          );
        }
      }

      images.forEach((image) => URL.revokeObjectURL(image.preview));

      router.replace("/admin/products");
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while saving the product.";

      setError(message);

      // Clean up uploaded files if product creation itself failed.
      if (
        uploadedImages.length > 0 &&
        !message.startsWith("The product was created")
      ) {
        await deleteUploadedFiles(
          uploadedImages.map((image) => image.objectKey)
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Jiwrap Admin</h2>

        <nav>
          <a href="/admin/dashboard">Dashboard Overview</a>
          <a href="/admin/dashboard#website-management">
            Website Management
          </a>
          <a href="/admin/products" className="active">
            Product Management
          </a>
          <a href="/admin/categories">Categories</a>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Add New Product</h1>
          <span>Jiwrap Administrator</span>
        </header>

        <section className="admin-products">
          <div className="admin-products-header">
            <div>
              <h2>Product Details</h2>
              <p>Add a new product to your Jiwrap catalogue.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="product-form">
            <div className="product-form-section">
              <h3>Basic Information</h3>

              <label>Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => updateName(event.target.value)}
                placeholder="e.g. Custom Printed Shopping Bags"
              />

              <label>Product URL / Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="custom-printed-shopping-bags"
              />

              <label>Product Category *</label>
              <select
                required
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={categoriesLoading || categories.length === 0}
              >
                <option value="">
                  {categoriesLoading
                    ? "Loading categories..."
                    : categories.length === 0
                      ? "No active categories available"
                      : "Select a category"}
                </option>

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
                onChange={(event) =>
                  setShortDescription(event.target.value)
                }
                placeholder="A brief description of the product"
              />

              <label>Full Description</label>
              <textarea
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the product, its features and uses"
              />
            </div>

            {/* PRODUCT IMAGES */}
            <div className="product-form-section">
              <h3>Product Images</h3>

              <p>
                Upload up to {MAX_IMAGES} images. JPG, PNG, WebP and AVIF
                are supported. Maximum 10MB per image.
              </p>

              <label className="product-image-upload">
                <span>+ Add Product Images</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  multiple
                  onChange={handleImageSelection}
                  disabled={loading || images.length >= MAX_IMAGES}
                />
              </label>

              {images.length > 0 && (
                <div className="product-image-grid">
                  {images.map((image) => (
                    <div
                      className={`product-image-card ${
                        mainImageId === image.id ? "main-image" : ""
                      }`}
                      key={image.id}
                    >
                      <img src={image.preview} alt={image.file.name} />

                      {mainImageId === image.id && (
                        <span className="main-image-label">
                          Main Image
                        </span>
                      )}

                      <div className="product-image-actions">
                        {mainImageId !== image.id && (
                          <button
                            type="button"
                            onClick={() => setMainImageId(image.id)}
                            disabled={loading}
                          >
                            Set as Main
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => removeImage(image.id)}
                          disabled={loading}
                        >
                          Remove
                        </button>
                      </div>

                      <small>{image.file.name}</small>
                    </div>
                  ))}
                </div>
              )}

              <p>
                {images.length} of {MAX_IMAGES} images selected.
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
                    placeholder="0.00"
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
                    placeholder="Optional"
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
              <a
                href="/admin/products"
                className="product-cancel-button"
              >
                Cancel
              </a>

              <button
                type="submit"
                className="admin-primary-button"
                disabled={
                  loading ||
                  categoriesLoading ||
                  categories.length === 0
                }
              >
                {loading ? "Saving Product and Images..." : "Save Product"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
