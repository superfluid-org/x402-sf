import { NextRequest, NextResponse } from "next/server";
import { verifyAuthAndSubscription, AuthPayload } from "../lib/auth";
import { checkRateLimit } from "../lib/ratelimit";

const VENICE_API_URL = "https://api.venice.ai/api/v1";
const VENICE_API_KEY = process.env.VENICE_API_KEY;

export async function POST(request: NextRequest) {
  if (!VENICE_API_KEY) {
    return NextResponse.json(
      { error: "Venice API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { messages, model = "llama-3.3-70b", auth } = body;

    // Verify authentication and subscription
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    let verifiedAddress: string;
    try {
      verifiedAddress = await verifyAuthAndSubscription(auth as AuthPayload);
    } catch (authError: any) {
      const status = authError.message.includes("subscription") ? 402 : 401;
      return NextResponse.json(
        { error: authError.message },
        { status }
      );
    }

    // Rate limit: 10 requests per day per user
    const rateLimit = await checkRateLimit(verifiedAddress);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${rateLimit.limit} requests/day). Come back tomorrow!`,
          remaining: rateLimit.remaining,
          limit: rateLimit.limit,
        },
        { status: 429 }
      );
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VENICE_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        venice_parameters: {
          enable_web_search: "auto",
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || "Venice API request failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Include rate limit info in response
    return NextResponse.json({
      ...data,
      _rateLimit: {
        remaining: rateLimit.remaining,
        limit: rateLimit.limit,
      },
    });
  } catch (error: any) {
    console.error("Venice chat error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
