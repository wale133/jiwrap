
import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !key) {
    return NextResponse.json({
      connected: false,
      message: "Missing Supabase credentials.",
    });
  }

  try {
    const response = await fetch(
      `${url}/rest/v1/products?select=id&limit=1`,
      {
        headers: {
          apikey: key,
        },
        cache: "no-store",
      }
    );

    if (response.ok) {
      return NextResponse.json({
        connected: true,
        message: "Jiwrap is connected to Supabase.",
      });
    }

    if (response.status === 404) {
      return NextResponse.json({
        connected: true,
        message: "Supabase credentials accepted. Products table is not created yet.",
      });
    }

    return NextResponse.json({
      connected: false,
      status: response.status,
      message: await response.text(),
    });
  } catch {
    return NextResponse.json({
      connected: false,
      message: "Unable to reach Supabase.",
    });
  }
}
