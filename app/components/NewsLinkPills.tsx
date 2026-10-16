"use client";

import Link from "next/link";
import { Icon } from "./Icons";

/**
 * ردیف لینک‌های یک خبر: منبع اصلی (باما)، نسخهٔ بازنویسی‌شدهٔ AI (خودِ سایت)،
 * و در صورت وجود، لینک پست تلگرام و اینستاگرام.
 *
 * هر لینک یک «pill» با کادر border یکدست و آیکون تک‌رنگ است.
 * اگر لینک تلگرام/اینستاگرام موجود نباشد، به‌صورت disabled نشان داده می‌شود.
 */

export interface NewsLinkPillsProps {
  sourceUrl: string | null;
  aiSlug: string; // slug صفحهٔ خبر روی خودِ سایت
  telegramUrl?: string | null;
  instagramUrl?: string | null;
}

export function NewsLinkPills({
  sourceUrl,
  aiSlug,
  telegramUrl,
  instagramUrl,
}: NewsLinkPillsProps) {
  // لینک تمیز تلگرام به کانال خبری رسمی
  let finalTelegramUrl: string | null = null;
  if (telegramUrl) {
    if (telegramUrl.includes("t.me/autopulsenewsai")) {
      finalTelegramUrl = telegramUrl;
    } else {
      const msgMatch = telegramUrl.match(/\/(\d+)$/);
      finalTelegramUrl = msgMatch ? `https://t.me/autopulsenewsai/${msgMatch[1]}` : "https://t.me/autopulsenewsai";
    }
  } else {
    finalTelegramUrl = "https://t.me/autopulsenewsai";
  }

  // لینک تمیز اینستاگرام به پیج یا پست منتشرشده
  let finalInstagramUrl: string | null = null;
  if (instagramUrl) {
    if (instagramUrl.startsWith("https://instagram.com/") || instagramUrl.startsWith("https://www.instagram.com/")) {
      finalInstagramUrl = instagramUrl;
    } else {
      finalInstagramUrl = "https://instagram.com/autopulsenews";
    }
  } else {
    finalInstagramUrl = "https://instagram.com/autopulsenews";
  }

  return (
    <div className="link-pills">
      {/* منبع اصلی خبر: باما (bama.ir) */}
      {sourceUrl ? (
        <a
          className="link-pill"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="مشاهده خبر اصلی در پایگاه باما (bama.ir)"
        >
          <span className="link-pill__icon">
            <Icon name="source" size={13} />
          </span>
          منبع: باما
        </a>
      ) : (
        <a
          className="link-pill"
          href="https://bama.ir/news"
          target="_blank"
          rel="noopener noreferrer"
          title="پایگاه خبری باما (منبع اصلی)"
        >
          <span className="link-pill__icon">
            <Icon name="source" size={13} />
          </span>
          منبع: باما
        </a>
      )}

      {/* نسخهٔ بازنویسی‌شدهٔ AI (سایت AutoPulse) */}
      <Link
        className="link-pill link-pill--primary"
        href={`/news/${aiSlug}`}
        title="نسخه بازنویسی‌شده اختصاصی AutoPulse"
      >
        <span className="link-pill__icon">
          <Icon name="ai" size={13} />
        </span>
        نسخهٔ AI
      </Link>

      {/* کانال تلگرام */}
      <a
        className="link-pill"
        href={finalTelegramUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="مشاهده در کانال تلگرام AutoPulse"
      >
        <span className="link-pill__icon">
          <Icon name="telegram" size={13} />
        </span>
        کانال تلگرام
      </a>

      {/* صفحه اینستاگرام */}
      <a
        className="link-pill"
        href={finalInstagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="مشاهده در صفحه اینستاگرام AutoPulse"
      >
        <span className="link-pill__icon">
          <Icon name="instagram" size={13} />
        </span>
        اینستاگرام
      </a>
    </div>
  );
}
