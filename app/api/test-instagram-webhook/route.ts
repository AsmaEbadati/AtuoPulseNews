import { NextResponse } from "next/server";
import { sendToMakeWebhook, DEFAULT_MAKE_WEBHOOK_URL } from "@/lib/publisher/instagram";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const webhookUrl =
      body.webhook_url?.trim() ||
      process.env.MAKE_INSTAGRAM_WEBHOOK_URL ||
      DEFAULT_MAKE_WEBHOOK_URL;

    if (!webhookUrl || !webhookUrl.startsWith("https://")) {
      return NextResponse.json(
        {
          success: false,
          error: "آدرس وب‌هوک معتبر نیست (باید با https:// شروع شود).",
        },
        { status: 400 }
      );
    }

    const testPayload = {
      news_id: "test-" + Date.now(),
      title: "تست اتصال AutoPulse به Make و اینستاگرام",
      caption: "🚗 این یک پست تست خودکار از سامانه هوشمند AutoPulse است.\n\n#خودرو #ماشین #AutoPulse #تست",
      image_url: "https://jcycygforwzryomjeyki.supabase.co/storage/v1/object/public/news/test-preview.jpg",
      aspect_ratio: "1:1",
      width: 1080,
      height: 1080,
      timestamp: new Date().toISOString(),
    };

    const res = await sendToMakeWebhook(webhookUrl, testPayload);

    if (res.success) {
      return NextResponse.json({
        success: true,
        message: "ارتباط با Make با موفقیت برقرار شد و رویداد تستی ارسال گردید.",
        responseText: res.responseText,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: res.error || "خطا در برقراری ارتباط با وب‌هوک Make.",
        },
        { status: 502 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
