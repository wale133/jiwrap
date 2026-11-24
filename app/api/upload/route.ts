
import { NextRequest, NextResponse } from "next/server";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import {
  r2Client,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
} from "@/lib/cloudflare/r2";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
];

const ALLOWED_FOLDERS = [
  "products",
  "banners",
  "hero",
];

async function verifyAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      authorised: false,
      status: 401,
    };
  }

  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !admin) {
    return {
      authorised: false,
      status: 403,
    };
  }

  return {
    authorised: true,
    status: 200,
  };
}

export async function POST(request: NextRequest) {
  try {
    const access = await verifyAdmin();

    if (!access.authorised) {
      return NextResponse.json(
        {
          error: "You are not authorised to upload files.",
        },
        { status: access.status }
      );
    }

    const body = await request.json();

    const { contentType, size, folder } = body;

    if (
      typeof contentType !== "string" ||
      typeof size !== "number" ||
      !Number.isFinite(size) ||
      size <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid file information.",
        },
        { status: 400 }
      );
    }

    const isImage = ALLOWED_IMAGE_TYPES.includes(contentType);
    const isVideo = ALLOWED_VIDEO_TYPES.includes(contentType);

    if (!isImage && !isVideo) {
      return NextResponse.json(
        {
          error: "Unsupported file format. Use JPG, PNG, WebP, AVIF or MP4.",
        },
        { status: 400 }
      );
    }

    if (isImage && size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        {
          error: "Images must be smaller than 10MB.",
        },
        { status: 400 }
      );
    }

    if (isVideo && size > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        {
          error: "Hero videos must be smaller than 100MB.",
        },
        { status: 400 }
      );
    }

    if (
      typeof folder !== "string" ||
      !ALLOWED_FOLDERS.includes(folder)
    ) {
      return NextResponse.json(
        {
          error: "Invalid upload folder.",
        },
        { status: 400 }
      );
    }

    if (isVideo && folder !== "hero") {
      return NextResponse.json(
        {
          error: "MP4 videos can only be uploaded to the hero folder.",
        },
        { status: 400 }
      );
    }

    if (isImage && folder === "hero") {
      return NextResponse.json(
        {
          error: "The hero folder only accepts MP4 videos.",
        },
        { status: 400 }
      );
    }

    const extensionMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/avif": "avif",
      "video/mp4": "mp4",
    };

    const extension = extensionMap[contentType];

    const fileName = `${crypto.randomUUID()}.${extension}`;
    const objectKey = `${folder}/${fileName}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(
      r2Client,
      command,
      {
        expiresIn: 300,
      }
    );

    const publicUrl =
      `${R2_PUBLIC_URL.replace(/\/$/, "")}/${objectKey}`;

    return NextResponse.json({
      uploadUrl,
      objectKey,
      publicUrl,
      contentType,
    });
  } catch (error) {
    console.error("R2 upload preparation error:", error);

    return NextResponse.json(
      {
        error: "Could not prepare file upload.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await verifyAdmin();

    if (!access.authorised) {
      return NextResponse.json(
        {
          error: "You are not authorised to delete files.",
        },
        { status: access.status }
      );
    }

    const body = await request.json();
    const { objectKey } = body;

    if (
      typeof objectKey !== "string" ||
      !/^(products|banners|hero)\/[a-zA-Z0-9._-]+$/.test(objectKey)
    ) {
      return NextResponse.json(
        {
          error: "Invalid file reference.",
        },
        { status: 400 }
      );
    }

    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: objectKey,
      })
    );

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("R2 file deletion error:", error);

    return NextResponse.json(
      {
        error: "Could not delete file.",
      },
      { status: 500 }
    );
  }
}
