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
  return (
    <div className="link-pills">
      {/* منبع اصلی خبر */}
      {sourceUrl ? (
        <a
          className="link-pill"
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="خبر اصلی در باما"
        >
          <span className="link-pill__icon">
            <Icon name="source" size={13} />
          </span>
          منبع
        </a>
      ) : (
        <span className="link-pill link-pill--disabled">
          <span className="link-pill__icon">
            <Icon name="source" size={13} />
          </span>
          منبع
        </span>
      )}

      {/* نسخهٔ بازنویسی‌شدهٔ AI (همین سایت) */}
      <Link
        className="link-pill link-pill--primary"
        href={`/news/${aiSlug}`}
        title="نسخهٔ بازنویسی‌شدهٔ AI"
      >
        <span className="link-pill__icon">
          <Icon name="ai" size={13} />
        </span>
        نسخهٔ AI
      </Link>

      {/* پست تلگرام */}
      {telegramUrl ? (
        <a
          className="link-pill"
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="پست در تلگرام"
        >
          <span className="link-pill__icon">
            <Icon name="telegram" size={13} />
          </span>
          تلگرام
        </a>
      ) : (
        <span className="link-pill link-pill--disabled" title="هنوز در تلگرام منتشر نشده">
          <span className="link-pill__icon">
            <Icon name="telegram" size={13} />
          </span>
          تلگرام
        </span>
      )}

      {/* پست اینستاگرام */}
      {instagramUrl ? (
        <a
          className="link-pill"
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="پست در اینستاگرام"
        >
          <span className="link-pill__icon">
            <Icon name="instagram" size={13} />
          </span>
          اینستاگرام
        </a>
      ) : (
        <span className="link-pill link-pill--disabled" title="هنوز در اینستاگرام منتشر نشده">
          <span className="link-pill__icon">
            <Icon name="instagram" size={13} />
          </span>
          اینستاگرام
        </span>
      )}
    </div>
  );
}
