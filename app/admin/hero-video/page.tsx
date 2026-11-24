
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "../../../lib/supabase/client";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

type HeroVideoContent = {
  video_url?: string;
  object_key?: string;
  updated_at?: string;
};

export default function HeroVideoPage() {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [authorised, setAuthorised] = useState(false);
  const [currentVideo, setCurrentVideo] = useState("");
  const [currentObjectKey, setCurrentObjectKey] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;

    async function loadVideo() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          window.location.href = "/admin/login";
          return;
        }

        const { data: admin, error: adminError } = await supabase
          .from("admin_users")
          .select("user_id, role, is_active")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .maybeSingle();

        if (
          adminError ||
          !admin ||
          admin.role !== "admin"
        ) {
          window.location.href = "/admin/login";
          return;
        }

        if (!active) return;

        setAuthorised(true);

        const { data, error: contentError } = await supabase
          .from("site_content")
          .select("id, content")
          .eq("section_key", "hero_video")
          .maybeSingle();

        if (contentError) throw contentError;

        if (data?.content) {
          const content = data.content as HeroVideoContent;

          if (active) {
            setCurrentVideo(content.video_url || "");
            setCurrentObjectKey(content.object_key || "");
          }
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load hero video settings."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadVideo();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(file?: File) {
    setError("");
    setSuccess("");

    if (!file) return;

    if (file.type !== "video/mp4") {
      setError("Please select an MP4 video.");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      setError("Your video must be smaller than 100MB.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function saveVideo() {
    if (!selectedFile) {
      setError("Please select a video first.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    let newObjectKey = "";

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/admin/login";
        return;
      }

      // Prepare secure R2 upload.
      const prepareResponse = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentType: selectedFile.type,
          size: selectedFile.size,
          folder: "hero",
        }),
      });

      const uploadData = await prepareResponse.json();

      if (!prepareResponse.ok) {
        throw new Error(
          uploadData.error || "Could not prepare video upload."
        );
      }

      // Upload video directly to Cloudflare R2.
      const uploadResponse = await fetch(uploadData.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": selectedFile.type,
        },
        body: selectedFile,
      });

      if (!uploadResponse.ok) {
        throw new Error("Video upload failed. Please try again.");
      }

      newObjectKey = uploadData.objectKey;

      const content = {
        video_url: uploadData.publicUrl,
        object_key: uploadData.objectKey,
        updated_at: new Date().toISOString(),
      };

      // Find existing hero video setting.
      const { data: existing, error: findError } = await supabase
        .from("site_content")
        .select("id, content")
        .eq("section_key", "hero_video")
        .maybeSingle();

      if (findError) throw findError;

      let saveError;

      if (existing) {
        const result = await supabase
          .from("site_content")
          .update({
            content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        saveError = result.error;
      } else {
        const result = await supabase
          .from("site_content")
          .insert({
            section_key: "hero_video",
            content,
            updated_at: new Date().toISOString(),
          });

        saveError = result.error;
      }

      if (saveError) throw saveError;

      // Delete previous video only after the new setting is saved.
      if (currentObjectKey && currentObjectKey !== newObjectKey) {
        await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            objectKey: currentObjectKey,
          }),
        });
      }

      setCurrentVideo(uploadData.publicUrl);
      setCurrentObjectKey(uploadData.objectKey);
      setSelectedFile(null);

      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl("");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setSuccess("Your homepage hero video has been saved successfully.");

    } catch (err: unknown) {
      console.error("HERO VIDEO SAVE ERROR:", err);

      // Clean up newly uploaded R2 file if saving its database record failed.
      if (newObjectKey) {
        try {
          const cleanupResponse = await fetch("/api/upload", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              objectKey: newObjectKey,
            }),
          });

          if (!cleanupResponse.ok) {
            const cleanupData = await cleanupResponse.json().catch(() => null);

            console.error(
              "VIDEO CLEANUP ERROR:",
              cleanupData?.error || cleanupResponse.statusText
            );
          }
        } catch (cleanupError) {
          console.error("VIDEO CLEANUP ERROR:", cleanupError);
        }
      }

      let errorMessage = "Could not save hero video.";

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === "object" && err !== null) {
        const databaseError = err as {
          message?: string;
          details?: string;
          hint?: string;
          code?: string;
        };

        const parts = [
          databaseError.message,
          databaseError.details,
          databaseError.hint ? `Hint: ${databaseError.hint}` : "",
          databaseError.code ? `Code: ${databaseError.code}` : "",
        ].filter(Boolean);

        if (parts.length > 0) {
          errorMessage = parts.join(" — ");
        }
      }

      setError(errorMessage);

    } finally {
      setSaving(false);
    }
  }

  async function removeVideo() {
    if (!currentVideo) return;

    const confirmed = window.confirm(
      "Remove the current homepage hero video?"
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const { data: existing, error: findError } = await supabase
        .from("site_content")
        .select("id")
        .eq("section_key", "hero_video")
        .maybeSingle();

      if (findError) throw findError;

      if (existing) {
        const { error: updateError } = await supabase
          .from("site_content")
          .update({
            content: {
              video_url: null,
              object_key: null,
              updated_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
      }

      if (currentObjectKey) {
        const deleteResponse = await fetch("/api/upload", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            objectKey: currentObjectKey,
          }),
        });

        if (!deleteResponse.ok) {
          throw new Error(
            "The video setting was cleared, but the old R2 file could not be deleted."
          );
        }
      }

      setCurrentVideo("");
      setCurrentObjectKey("");
      setSuccess("The homepage hero video has been removed.");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not remove the video."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="admin-layout">
        <div className="admin-main">
          <section className="admin-content">
            <p>Loading website settings...</p>
          </section>
        </div>
      </main>
    );
  }

  if (!authorised) return null;

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Jiwrap Admin</h2>

        <nav>
          <Link href="/admin/dashboard">
            Dashboard Overview
          </Link>

          <Link href="/admin/hero-video" className="active">
            Website Management
          </Link>

          <Link href="/admin/products">
            Product Management
          </Link>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h1>Website Management</h1>
          <span>Hero Video Settings</span>
        </header>

        <section className="admin-content">
          <div style={{ marginBottom: 28 }}>
            <Link
              href="/admin/dashboard"
              style={{
                color: "#651F35",
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              ← Back to Dashboard
            </Link>

            <h2 style={{ marginTop: 22 }}>
              Homepage Hero Video
            </h2>

            <p className="admin-subtitle">
              Upload and manage the video displayed in your homepage hero section.
            </p>
          </div>

          <div
            className="admin-stat-card"
            style={{
              maxWidth: 850,
              padding: 28,
            }}
          >
            <h3>Current homepage video</h3>

            {currentVideo ? (
              <video
                key={currentVideo}
                src={currentVideo}
                controls
                playsInline
                preload="metadata"
                style={{
                  display: "block",
                  width: "100%",
                  maxHeight: 430,
                  background: "#171717",
                  borderRadius: 12,
                  marginTop: 18,
                }}
              />
            ) : (
              <div
                style={{
                  marginTop: 18,
                  padding: 50,
                  background: "#25252A",
                  color: "#fff",
                  borderRadius: 12,
                  textAlign: "center",
                }}
              >
                <h3>No hero video uploaded</h3>
                <p>
                  Upload an MP4 video to use on your homepage.
                </p>
              </div>
            )}

            <div
              style={{
                marginTop: 28,
                paddingTop: 24,
                borderTop: "1px solid #e5e5e5",
              }}
            >
              <h3>Upload a replacement video</h3>

              <p
                style={{
                  color: "#777",
                  marginTop: 8,
                  marginBottom: 18,
                }}
              >
                MP4 format only. Maximum file size: 100MB.
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4"
                onChange={(event) =>
                  handleFileChange(event.target.files?.[0])
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginBottom: 18,
                }}
              />

              {selectedFile && (
                <div style={{ marginBottom: 20 }}>
                  <h3>New video preview</h3>

                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    style={{
                      display: "block",
                      width: "100%",
                      maxHeight: 350,
                      background: "#171717",
                      borderRadius: 12,
                      marginTop: 12,
                    }}
                  />

                  <p style={{ marginTop: 10, color: "#777" }}>
                    {selectedFile.name} —{" "}
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  style={{
                    color: "#b42318",
                    background: "#fef3f2",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  {error}
                </p>
              )}

              {success && (
                <p
                  role="status"
                  style={{
                    color: "#067647",
                    background: "#ecfdf3",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 16,
                  }}
                >
                  {success}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={saveVideo}
                  disabled={!selectedFile || saving}
                  style={{
                    border: 0,
                    background: "#651F35",
                    color: "#fff",
                    padding: "13px 24px",
                    borderRadius: 8,
                    cursor: selectedFile && !saving ? "pointer" : "not-allowed",
                    opacity: selectedFile && !saving ? 1 : 0.5,
                    fontWeight: 600,
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>

                {currentVideo && (
                  <button
                    type="button"
                    onClick={removeVideo}
                    disabled={saving}
                    style={{
                      border: "1px solid #b42318",
                      background: "#fff",
                      color: "#b42318",
                      padding: "13px 24px",
                      borderRadius: 8,
                      cursor: saving ? "not-allowed" : "pointer",
                    }}
                  >
                    Remove Current Video
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
