import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getArticleWithLinks } from "@/lib/news-links";
import { Icon, IconBox } from "../../components/Icons";
import { NewsLinkPills } from "../../components/NewsLinkPills";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getArticle(slug: string) {
  return getArticleWithLinks(slug);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "خبر یافت نشد" };
  const desc = (article.body ?? "").slice(0, 160);
  return {
    title: article.title,
    description: desc,
    openGraph: {
      title: article.title,
      description: desc,
      type: "article",
      ...(article.image_url && { images: [article.image_url] }),
    },
  };
}

export default async function NewsArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  if (!article) notFound();

  const paragraphs = (article.body ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <article className="section">
      <div className="container">
        <div className="article">
          {/* Breadcrumb */}
          <nav className="article__crumb">
            <Link href="/" className="article__crumb-back">
              <Icon name="back" size={16} />
              خانه
            </Link>
          </nav>

          {/* Header */}
          <header className="article__header">
            <span className="badge badge--primary">
              <Icon name="ai" size={12} />
              بازنویسی‌شده با هوش مصنوعی
            </span>

            <h1 className="article__title">{article.title}</h1>

            <div className="article__meta">
              <span>
                <Icon name="clock" size={14} />
                {formatDate(article.created_at)}
              </span>
              <span>
                <Icon name="source" size={14} />
                منبع: باما
              </span>
              <span>
                <Icon name="chart" size={14} />
                {(article.body ?? "").length} کاراکتر
              </span>
            </div>

            {/* Hero Image */}
            <div className="article__hero">
              {article.image_url ? (
                <img src={article.image_url} alt={article.title} />
              ) : (
                <div className="article__hero-placeholder">
                  <Icon name="image" size={56} />
                </div>
              )}
            </div>
          </header>

          {/* Body */}
          <div className="article__content">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Links: منبع / AI / تلگرام / اینستاگرام */}
          <div className="article__links">
            <div className="article__links-label">
              <IconBox name="link" tone="primary" size={16} />
              <span>این خبر در پلتفرم‌های دیگر</span>
            </div>
            <NewsLinkPills
              sourceUrl={article.source_url}
              aiSlug={article.slug}
              telegramUrl={article.telegram_url}
              instagramUrl={article.instagram_url}
            />
          </div>

          {/* Back */}
          <div className="article__back">
            <Link href="/" className="btn btn--secondary">
              <Icon name="back" size={16} />
              بازگشت به فهرست اخبار
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
