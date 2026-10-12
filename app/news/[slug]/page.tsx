import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";

// --- Mock data (فاز اول) ---
const mockArticles: Record<
  string,
  {
    id: string;
    slug: string;
    title: string;
    image_url: string | null;
    created_at: string;
    published_website: boolean;
    published_telegram: boolean;
    published_instagram: boolean;
    content_website: string;
    source_url: string;
    telegram_message_id: string | null;
    instagram_post_id: string | null;
  }
> = {
  "nemo-1": {
    id: "1",
    slug: "nemo-1",
    title: "قیمت‌گذاری جدید خودروهای داخلی در آبان ماه",
    image_url: null,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    published_website: true,
    published_telegram: true,
    published_instagram: false,
    source_url: "https://bama.ir/news/nemo-1",
    telegram_message_id: "12345",
    instagram_post_id: null,
    content_website:
      "بر اساس آخرین مصوبات شورای رقابت، قیمت‌گذاری محصولات خودروسازان داخلی در ماه آبان مورد بازبینی قرار گرفت. این تغییرات شامل چندین مدل پرفروش از جمله پژو ۲۰۶، سمند و تیبا می‌شود که انتظار می‌رود تأثیر قابل توجهی بر بازار خودرو کشور داشته باشد. کارشناسان معتقدند این اصلاح قیمت‌ها می‌تواند به تنظیم بازار و کاهش فاصله قیمت‌های کارخانه با بازار آزاد کمک کند. در این راستا، خودروسازان موظف شده‌اند لیست قیمت‌های جدید را تا پایان هفته اعلام کنند.",
  },
  "nemo-2": {
    id: "2",
    slug: "nemo-2",
    title: "رونمایی از محصول جدید سایپا با موتور توربو",
    image_url: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    published_website: true,
    published_telegram: true,
    published_instagram: true,
    source_url: "https://bama.ir/news/nemo-2",
    telegram_message_id: "12346",
    instagram_post_id: "ig_post_456",
    content_website:
      "گروه خودروسازی سایپا از محصول تازه خود با موتور توربو شارژ ۱.۵ لیتری رونمایی کرد. این خودرو با توان ۱۳۵ اسب بخار و گشتاور ۲۳۵ نیوتون متر، پیشرفته‌ترین محصول این خودروساز در تاریخ خود محسوب می‌شود. پیش‌فروش این مدل از اواخر آبان ماه آغاز می‌شود و قیمت پایه آن ۸۵۰ میلیون تومان اعلام شده است. این خودرو با سیستم ترمز ABS، کیسه هوا مضاعف و صفحه نمایش لمسی هوشمند به بازار عرضه خواهد شد.",
  },
  "nemo-3": {
    id: "3",
    slug: "nemo-3",
    title: "واردات خودروهای هیبریدی در سال جاری دو برابر شد",
    image_url: null,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    published_website: true,
    published_telegram: false,
    published_instagram: false,
    source_url: "https://bama.ir/news/nemo-3",
    telegram_message_id: null,
    instagram_post_id: null,
    content_website:
      "آمار گمرک ایران نشان می‌دهد که واردات خودروهای هیبریدی در ۹ ماهه سال جاری نسبت به مدت مشابه سال گذشته بیش از ۱۰۰ درصد رشد داشته است. این روند با توجه به افزایش آگاهی مصرف‌کنندگان از مزایای خودروهای کم‌مصرف ادامه خواهد داشت. برندهای تویوتا، هیوندای و کیا بیشترین سهم از این واردات را دارند. کارشناسان پیش‌بینی می‌کنند با تداوم این روند، بازار خودروهای هیبریدی تا پایان سال به ۵ درصد از کل فروش خودرو برسد.",
  },
};

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = mockArticles[slug];

  if (!article) {
    return { title: "خبر یافت نشد" };
  }

  return {
    title: article.title,
    description: article.content_website.slice(0, 160),
    openGraph: {
      title: article.title,
      description: article.content_website.slice(0, 160),
      type: "article",
      ...(article.image_url && { images: [article.image_url] }),
    },
  };
}

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = mockArticles[slug];

  if (!article) {
    notFound();
  }

  return (
    <article style={{ paddingBlock: "var(--space-10)" }}>
      <div className="container">
        <div className="article-body">
          {/* Breadcrumb */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              marginBottom: "var(--space-6)",
              fontSize: "var(--text-sm)",
              color: "var(--color-muted)",
            }}
          >
            <Link href="/" className="btn btn--ghost" style={{ padding: 0 }}>
              خانه
            </Link>
            <span>›</span>
            <span style={{ color: "var(--color-text-2)" }}>
              {article.title}
            </span>
          </nav>

          {/* Header */}
          <header style={{ marginBottom: "var(--space-8)" }}>
            {/* AI Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.25rem 0.75rem",
                background: "var(--color-primary-glow)",
                border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: "9999px",
                fontSize: "var(--text-xs)",
                color: "var(--color-primary)",
                fontWeight: 600,
                marginBottom: "var(--space-4)",
              }}
            >
              ✨ پردازش‌شده با هوش مصنوعی
            </div>

            <h1
              style={{
                fontSize: "clamp(1.5rem, 4vw, 2.25rem)",
                fontWeight: 800,
                lineHeight: 1.3,
                marginBottom: "var(--space-4)",
                color: "var(--color-text)",
              }}
            >
              {article.title}
            </h1>

            {/* Meta */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                flexWrap: "wrap",
                marginBottom: "var(--space-5)",
              }}
            >
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-muted)",
                }}
              >
                🕐 {formatDate(article.created_at)}
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-muted)",
                }}
              >
                📰 منبع: باما
              </span>
              <span
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--color-muted)",
                }}
              >
                📝 {article.content_website.length} کاراکتر
              </span>
            </div>

            {/* Hero Image or placeholder */}
            <div className="article-hero">
              {article.image_url ? (
                <img src={article.image_url} alt={article.title} />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--gradient-hero)",
                    fontSize: "6rem",
                    color: "var(--color-muted-2)",
                  }}
                >
                  🚗
                </div>
              )}
            </div>
          </header>

          {/* Content */}
          <p>{article.content_website}</p>

          {/* Source Link */}
          <div
            style={{
              marginTop: "var(--space-6)",
              padding: "var(--space-4)",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-lg)",
              fontSize: "var(--text-sm)",
              color: "var(--color-muted)",
            }}
          >
            منبع اصلی:{" "}
            <a
              href={article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-primary)" }}
            >
              {article.source_url}
            </a>
          </div>

          {/* Social Publishing Status */}
          <div className="article-social-links">
            <div style={{ width: "100%" }}>
              <h3
                style={{
                  fontSize: "var(--text-base)",
                  fontWeight: 700,
                  marginBottom: "var(--space-3)",
                  color: "var(--color-text-2)",
                }}
              >
                وضعیت انتشار
              </h3>
              <div
                style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}
              >
                {/* Website */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-4)",
                    background: article.published_website
                      ? "var(--color-success-bg)"
                      : "var(--color-surface)",
                    border: `1px solid ${
                      article.published_website
                        ? "rgba(16,185,129,0.2)"
                        : "var(--color-border)"
                    }`,
                    borderRadius: "var(--radius-lg)",
                    flex: 1,
                    minWidth: "140px",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>🌐</span>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-muted)",
                      }}
                    >
                      وب‌سایت
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        color: article.published_website
                          ? "var(--color-success)"
                          : "var(--color-muted)",
                      }}
                    >
                      {article.published_website ? "✓ منتشر شد" : "○ منتظر"}
                    </div>
                  </div>
                </div>

                {/* Telegram */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-4)",
                    background: article.published_telegram
                      ? "var(--color-success-bg)"
                      : "var(--color-surface)",
                    border: `1px solid ${
                      article.published_telegram
                        ? "rgba(16,185,129,0.2)"
                        : "var(--color-border)"
                    }`,
                    borderRadius: "var(--radius-lg)",
                    flex: 1,
                    minWidth: "140px",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>✈️</span>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-muted)",
                      }}
                    >
                      تلگرام
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        color: article.published_telegram
                          ? "var(--color-success)"
                          : "var(--color-muted)",
                      }}
                    >
                      {article.published_telegram
                        ? `✓ ارسال شد`
                        : "○ منتظر"}
                    </div>
                  </div>
                </div>

                {/* Instagram */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    padding: "var(--space-3) var(--space-4)",
                    background: article.published_instagram
                      ? "var(--color-success-bg)"
                      : "var(--color-surface)",
                    border: `1px solid ${
                      article.published_instagram
                        ? "rgba(16,185,129,0.2)"
                        : "var(--color-border)"
                    }`,
                    borderRadius: "var(--radius-lg)",
                    flex: 1,
                    minWidth: "140px",
                  }}
                >
                  <span style={{ fontSize: "1.25rem" }}>📸</span>
                  <div>
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        color: "var(--color-muted)",
                      }}
                    >
                      اینستاگرام
                    </div>
                    <div
                      style={{
                        fontSize: "var(--text-sm)",
                        fontWeight: 600,
                        color: article.published_instagram
                          ? "var(--color-success)"
                          : "var(--color-muted)",
                      }}
                    >
                      {article.published_instagram
                        ? `✓ منتشر شد`
                        : "○ منتظر"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
