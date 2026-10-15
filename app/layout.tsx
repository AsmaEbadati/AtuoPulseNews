import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { Icon } from "./components/Icons";

export const metadata: Metadata = {
  title: {
    template: "%s | AutoPulse AI",
    default: "AutoPulse AI — پایپ‌لاین هوشمند اخبار خودرویی",
  },
  description:
    "سیستم خودکار پایش، پردازش با هوش مصنوعی و انتشار اخبار خودرو باما در سایت، تلگرام و اینستاگرام",
  keywords: ["خودرو", "اخبار خودرو", "باما", "هوش مصنوعی", "AutoPulse"],
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "AutoPulse AI",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* Header */}
        <header className="header">
          <div className="container header__inner">
            {/* Logo */}
            <Link href="/" className="header__logo">
              <span className="header__logo-icon">
                <Icon name="sparkle" size={18} />
              </span>
              <span className="header__logo-text">AutoPulse AI</span>
            </Link>

            {/* Navigation */}
            <nav className="header__nav">
              <Link href="/" className="header__nav-link">
                اخبار
              </Link>
              <Link href="/schedule" className="header__nav-link">
                زمانبندی
              </Link>
              <Link href="/dashboard" className="header__nav-link">
                داشبورد
              </Link>
              <div className="header__badge">فعال</div>
            </nav>
          </div>
        </header>

        {/* Main content */}
        <main>{children}</main>

        {/* Footer */}
        <footer className="footer">
          <div className="container footer__inner">
            <p className="footer__copy">
              © ۱۴۰۵ · AutoPulse AI · پردازش هوشمند اخبار خودرو
            </p>
            <p className="footer__source">
              <Icon name="source" size={14} />
              منبع اخبار:
              <a
                href="https://bama.ir/news"
                target="_blank"
                rel="noopener noreferrer"
              >
                bama.ir/news
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
