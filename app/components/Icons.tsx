/**
 * AutoPulse — سیستم آیکون مینیمال و یکپارچه.
 *
 * قواعد طراحی:
 *  - همهٔ آیکون‌ها stroke-based (fill=none)، تک‌رنگ (currentColor)
 *  - viewBox یکسان ۲۴×۲۴، strokeWidth یکسان ۱.۵، گوشه‌های گرد
 *  - هیچ emoji‌ای به‌عنوان آیکون استفاده نمی‌شود
 *  - IconBox یک کادر border یکسان دور هر آیکون می‌کشد (ظاهر یکدست)
 */

export type IconName =
  | "source"      // لینک خبر اصلی (منبع)
  | "ai"          // لینک/نسخهٔ بازنویسی‌شدهٔ AI
  | "telegram"    // لینک پست تلگرام
  | "instagram"   // لینک پست اینستاگرام
  | "home"
  | "grid"        // داشبورد
  | "clock"
  | "check"
  | "alert"
  | "chart"
  | "external"
  | "back"
  | "image"
  | "sparkle"
  | "link";

const PATHS: Record<IconName, React.ReactNode> = {
  // globe + خطوط — «منبع اصلی»
  source: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
    </>
  ),
  // ستارهٔ چندپر — «هوش مصنوعی»
  ai: (
    <>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
      <path d="M18 15l.7 1.9L20.6 18l-1.9.7L18 20.6l-.7-1.9L15.4 18l1.9-.7L18 15z" />
    </>
  ),
  // paper-plane — تلگرام
  telegram: (
    <>
      <path d="M21 4L3 11l6 2.2L11.2 19 21 4z" />
      <path d="M9 13.2L21 4" />
    </>
  ),
  // دوربین — اینستاگرام
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // خانه
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v9h12v-9" />
    </>
  ),
  // ۴ خانه داشبورد
  grid: (
    <>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </>
  ),
  // ساعت
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  // تیک در دایره
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  // هشدار
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5" />
      <circle cx="12" cy="16" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  // نمودار
  chart: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4M12.5 16V8M17 16v-6" />
    </>
  ),
  // لینک بیرونی
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5l-8 8" />
      <path d="M18 14v4.5A1.5 1.5 0 0116.5 20h-11A1.5 1.5 0 014 18.5v-11A1.5 1.5 0 015.5 6H10" />
    </>
  ),
  // فلش چپ (بازگشت در RTL)
  back: (
    <>
      <path d="M9 5l7 7-7 7" />
    </>
  ),
  // تصویر
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M4 17l4.5-4.5L11 15l3-3 6 5" />
    </>
  ),
  // جرقهٔ کوچک
  sparkle: (
    <>
      <path d="M12 4l1.4 3.8L17 9l-3.6 1.2L12 14l-1.4-3.8L7 9l3.6-1.2L12 4z" />
    </>
  ),
  // زنجیرهٔ لینک
  link: (
    <>
      <path d="M10.5 13.5a4 4 0 005.7 0l2.3-2.3a4 4 0 10-5.7-5.7L11.5 6.7" />
      <path d="M13.5 10.5a4 4 0 00-5.7 0l-2.3 2.3a4 4 0 105.7 5.7l1.3-1.2" />
    </>
  ),
};

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

/** آیکون خالص (SVG). برای استفادهٔ تزئینی aria-hidden است. */
export function Icon({ name, size = 20, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}

interface IconBoxProps {
  name: IconName;
  size?: number;
  /** تن: neutral | primary | success | danger | accent */
  tone?: "neutral" | "primary" | "success" | "danger" | "accent";
  /** عنوان دسترسی‌پذیر (اگه آیکون معنا دارد) */
  label?: string;
}

/**
 * آیکون داخل یک کادر border یکدست. همیشه مربع/گرد با border یکسان،
 * تا همهٔ آیکون‌ها یک شکل و یک‌دست به نظر برسند.
 */
export function IconBox({ name, size = 20, tone = "neutral", label }: IconBoxProps) {
  return (
    <span className={`icon-box icon-box--${tone}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : "true"}>
      <Icon name={name} size={size} />
    </span>
  );
}
