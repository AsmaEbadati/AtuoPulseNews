import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "اخبار خودرو",
  description:
    "آخرین اخبار بازار خودرو ایران، پردازش‌شده با هوش مصنوعی و انتشار خودکار",
};

// --- Mock data برای فاز اول (قبل از اتصال به دیتابیس) ---
const mockArticles = [
  {
    id: "1",
    slug: "nemo-1",
    title: "قیمت‌گذاری جدید خودروهای داخلی در آبان ماه",
    image_url: null,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    published_website: true,
    published_telegram: true,
    published_instagram: false,
    content_website:
      "بر اساس آخرین مصوبات شورای رقابت، قیمت‌گذاری محصولات خودروسازان داخلی در ماه آبان مورد بازبینی قرار گرفت. این تغییرات شامل چندین مدل پرفروش از جمله پژو ۲۰۶، سمند و تیبا می‌شود که انتظار می‌رود تأثیر قابل توجهی بر بازار خودرو کشور داشته باشد.",
  },
  {
    id: "2",
    slug: "nemo-2",
    title: "رونمایی از محصول جدید سایپا با موتور توربو",
    image_url: null,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    published_website: true,
    published_telegram: true,
    published_instagram: true,
    content_website:
      "گروه خودروسازی سایپا از محصول تازه خود با موتور توربو شارژ ۱.۵ لیتری رونمایی کرد. این خودرو با توان ۱۳۵ اسب بخار و گشتاور ۲۳۵ نیوتون متر، پیشرفته‌ترین محصول این خودروساز در تاریخ خود محسوب می‌شود.",
  },
  {
    id: "3",
    slug: "nemo-3",
    title: "واردات خودروهای هیبریدی در سال جاری دو برابر شد",
    image_url: null,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    published_website: true,
    published_telegram: false,
    published_instagram: false,
    content_website:
      "آمار گمرک ایران نشان می‌دهد که واردات خودروهای هیبریدی در ۹ ماهه سال جاری نسبت به مدت مشابه سال گذشته بیش از ۱۰۰ درصد رشد داشته است. این روند با توجه به افزایش آگاهی مصرف‌کنندگان از مزایای خودروهای کم‌مصرف ادامه خواهد داشت.",
  },
];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffH = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffH < 1) return "چند دقیقه پیش";
  if (diffH < 24) return `${diffH} ساعت پیش`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} روز پیش`;
}

function PublishBadges({
  website,
  telegram,
  instagram,
}: {
  website: boolean;
  telegram: boolean;
  instagram: boolean;
}) {
  return (
    <div className="publish-badges">
      <span className={`badge badge--${website ? "success" : "pending"}`}>
        {website ? "✓" : "○"} سایت
      </span>
      <span className={`badge badge--${telegram ? "success" : "pending"}`}>
        {telegram ? "✓" : "○"} تلگرام
      </span>
      <span className={`badge badge--${instagram ? "success" : "pending"}`}>
        {instagram ? "✓" : "○"} اینستاگرام
      </span>
    </div>
  );
}

export default function HomePage() {
  const publishedCount = mockArticles.filter((a) => a.published_website).length;
  const totalPublished = mockArticles.reduce((acc, a) => {
    let count = 0;
    if (a.published_website) count++;
    if (a.published_telegram) count++;
    if (a.published_instagram) count++;
    return acc + count;
  }, 0);

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero__eyebrow">
            <span>⚡</span>
            <span>پایپ‌لاین هوشمند خبر خودرو</span>
          </div>

          <h1 className="hero__title">
            اخبار خودرو، <span>هوشمند و خودکار</span>
          </h1>

          <p className="hero__subtitle">
            پایش روزانه باما، پردازش با هوش مصنوعی و انتشار همزمان در سه
            پلتفرم — بدون دخالت انسانی
          </p>

          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value">{publishedCount}</div>
              <div className="hero__stat-label">خبر منتشرشده</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">۳</div>
              <div className="hero__stat-label">پلتفرم انتشار</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{totalPublished}</div>
              <div className="hero__stat-label">کل انتشارها</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">۰</div>
              <div className="hero__stat-label">تکرار</div>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          {/* Pipeline Status Bar */}
          <div className="pipeline-bar">
            <div className="pipeline-bar__status">
              <div className="pipeline-bar__dot pipeline-bar__dot--active" />
              <div>
                <div className="pipeline-bar__label">سیستم فعال است</div>
                <div className="pipeline-bar__meta">
                  آخرین اجرا: امروز ساعت ۰۸:۰۰
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/dashboard" className="btn btn--secondary">
                📊 داشبورد لاگ‌ها
              </Link>
              <button className="btn btn--primary">▶ اجرای دستی</button>
            </div>
          </div>

          {/* Section Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "1.5rem",
            }}
          >
            <h2
              style={{
                fontSize: "var(--text-xl)",
                fontWeight: 700,
                color: "var(--color-text)",
              }}
            >
              آخرین اخبار
            </h2>
            <span
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--color-muted)",
              }}
            >
              {mockArticles.length} خبر
            </span>
          </div>

          {/* Articles Grid */}
          {mockArticles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state__icon">📰</div>
              <div className="empty-state__title">هنوز خبری منتشر نشده</div>
              <div className="empty-state__desc">
                پایپ‌لاین را اجرا کنید تا اخبار باما جمع‌آوری و منتشر شوند.
              </div>
            </div>
          ) : (
            <div className="news-grid">
              {mockArticles.map((article, i) => (
                <Link
                  href={`/news/${article.slug}`}
                  key={article.id}
                  className="news-card animate-fade-up"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  {/* Image */}
                  <div className="news-card__image-wrap">
                    {article.image_url ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="news-card__image"
                      />
                    ) : (
                      <div className="news-card__image-placeholder">🚗</div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <span className="news-card__date">
                        🕐 {formatDate(article.created_at)}
                      </span>
                      <span
                        className="badge badge--success"
                        style={{ fontSize: "10px" }}
                      >
                        AI ✨
                      </span>
                    </div>

                    <h3 className="news-card__title">{article.title}</h3>

                    <p className="news-card__excerpt">
                      {article.content_website}
                    </p>

                    <div className="news-card__footer">
                      <PublishBadges
                        website={article.published_website}
                        telegram={article.published_telegram}
                        instagram={article.published_instagram}
                      />
                      <span
                        className="btn btn--ghost"
                        style={{ padding: "0", fontSize: "var(--text-sm)" }}
                      >
                        بیشتر →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
