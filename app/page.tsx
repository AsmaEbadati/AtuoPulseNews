import type { Metadata } from "next";
import { getArticlesWithLinks } from "@/lib/news-links";
import { Icon, IconBox } from "./components/Icons";
import { NewsLinkPills } from "./components/NewsLinkPills";

export const metadata: Metadata = {
  title: "اخبار خودرو",
  description:
    "آخرین اخبار بازار خودرو ایران، پردازش‌شده با هوش مصنوعی و انتشار خودکار",
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffH = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffH < 1) return "چند دقیقه پیش";
  if (diffH < 24) return `${diffH} ساعت پیش`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD} روز پیش`;
}

export default async function HomePage() {
  const articles = await getArticlesWithLinks(60);

  // شمارش پلتفرم‌هایی که حداقل یک لینک موفق دارند
  const telegramCount = articles.filter((a) => a.telegram_url).length;
  const instagramCount = articles.filter((a) => a.instagram_url).length;

  return (
    <>
      {/* Hero */}
      <section className="hero">
        <div className="container">
          <div className="hero__eyebrow">
            <Icon name="sparkle" size={14} />
            <span>پایپ‌لاین هوشمند خبر خودرو</span>
          </div>

          <h1 className="hero__title">
            اخبار خودرو، <span>هوشمند و خودکار</span>
          </h1>

          <p className="hero__subtitle">
            پایش روزانهٔ باما، بازنویسی با هوش مصنوعی و انتشار هم‌زمان در سایت،
            تلگرام و اینستاگرام — بدون دخالت انسانی.
          </p>

          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value">{articles.length}</div>
              <div className="hero__stat-label">خبر منتشرشده</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{telegramCount}</div>
              <div className="hero__stat-label">روی تلگرام</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{instagramCount}</div>
              <div className="hero__stat-label">روی اینستاگرام</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">۳</div>
              <div className="hero__stat-label">پلتفرم انتشار</div>
            </div>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container">
          <div className="section-head">
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <IconBox name="chart" tone="primary" size={18} />
              <h2 className="section-head__title">آخرین اخبار</h2>
            </div>
            <span className="section-head__meta">{articles.length} خبر</span>
          </div>

          {articles.length === 0 ? (
            <div className="empty-state">
              <IconBox name="image" size={40} />
              <div className="empty-state__title">هنوز خبری منتشر نشده</div>
              <div className="empty-state__desc">
                پایپ‌لاین هر روز به‌صورت خودکار اخبار باما را جمع‌آوری و منتشر
                می‌کند. لطفاً بعداً سر بزنید.
              </div>
            </div>
          ) : (
            <div className="news-grid">
              {articles.map((article, i) => (
                <article
                  key={article.id}
                  className="news-card animate-fade-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  {/* Image */}
                  <div className="news-card__image-wrap">
                    {article.image_url ? (
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="news-card__image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="news-card__image-placeholder">
                        <Icon name="image" size={32} />
                      </div>
                    )}
                  </div>

                  {/* Body */}
                  <div className="news-card__body">
                    <div className="news-card__meta">
                      <Icon name="clock" size={13} />
                      <span>{formatDate(article.created_at)}</span>
                      <span className="badge badge--primary">
                        <Icon name="ai" size={11} />
                        AI
                      </span>
                    </div>

                    <h3 className="news-card__title">
                      <a href={`/news/${article.slug}`}>{article.title}</a>
                    </h3>

                    <p className="news-card__excerpt">
                      {article.body?.slice(0, 150) ?? ""}…
                    </p>

                    <div className="news-card__footer">
                      <NewsLinkPills
                        sourceUrl={article.source_url}
                        aiSlug={article.slug}
                        telegramUrl={article.telegram_url}
                        instagramUrl={article.instagram_url}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
