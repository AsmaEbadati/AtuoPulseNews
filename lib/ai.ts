import type { AIGeneratedContent, RawNewsItem } from "./types";

/**
 * فاز ۳ — تولید محتوا با AI (NVIDIA NIM / build.nvidia.com).
 *
 * مسئولیت این ماژول: گرفتن یک خبر خام و تولید سه خروجی:
 *   - rewritten_text : متن بازنویسی‌شدهٔ فارسی (۹۰۰ تا ۱۱۰۰ کاراکتر، طبق constraint جدول)
 *   - tg_caption     : کپشن کوتاه تلگرام
 *   - ig_caption     : کپشن اینستاگرام + هشتگ
 *
 * نکتهٔ schema: جدول news_items یک CHECK دارد که rewritten_text را
 * حتماً بین ۹۰۰ و ۱۱۰۰ کاراکتر می‌خواهد. بنابراین خروجی را اعتبارسنجی
 * و در صورت لزوم یک بار بازتولید می‌کنیم.
 */

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

// بازهٔ ایمن داخل محدودیت جدول (۹۰۰..۱۱۰۰). هدف را کمی وسط نگه می‌داریم.
const MIN_LEN = 900;
const MAX_LEN = 1100;
const TARGET_LEN = 1000; // هدف ایده‌آل برای پرامپت

export const isAIConfigured = Boolean(process.env.NVIDIA_API_KEY);

function getApiKey(): string {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY is not configured.");
  return key;
}

function getModel(): string {
  return process.env.NVIDIA_API_MODEL || DEFAULT_MODEL;
}


export type AITone = "formal" | "exciting" | "technical" | "concise";

export interface ToneInfo {
  id: AITone;
  name: string;
  badge: string;
  description: string;
  sampleHeadline: string;
  sampleExcerpt: string;
  instruction: string;
}

export const AI_TONES: Record<AITone, ToneInfo> = {
  formal: {
    id: "formal",
    name: "رسمی و ژورنالیستی",
    badge: "استاندارد خبرگزاری",
    description: "لحن مطبوعاتی، موقر، دقیق و بدون اغراق، مناسب برای اخبار رسمی، بخشنامه‌ها و گزارش‌های مستند.",
    sampleHeadline: "اعلام شرایط جدید پیش‌فروش خودرو در سامانه یکپارچه",
    sampleExcerpt: "بر اساس آخرین اطلاعیه، ثبت‌نام متقاضیان از ابتدای هفته آینده با موعد تحویل ۹۰ روزه کاری آغاز خواهد شد...",
    instruction: "لحن بازنویسی کاملاً رسمی، ژورنالیستی، موقر و تحریریه‌ای باشد. از واژگان معتبر مطبوعاتی استفاده کن و از هرگونه بزرگ‌نمایی، زبان عامیانه یا حدس و گمان بپرهیز.",
  },
  exciting: {
    id: "exciting",
    name: "هیجانی و جذاب شبکه‌های اجتماعی",
    badge: "ویرال و پرتعامل",
    description: "تیترهای کنجکاوی‌برانگیز و جذاب، بیان پرانرژی و گیرا مناسب اکسپلور اینستاگرام و کانال‌های تلگرام.",
    sampleHeadline: "رونمایی از هیولای جدید جاده‌ها؛ شتاب خیره‌کننده و طراحی فضایی!",
    sampleExcerpt: "شاید باورتان نشود اما این غول جدید چینی با شتاب صفر تا صد ۶ ثانیه‌ای آماده است تا معادلات بازار خودرو را به هم بریزد...",
    instruction: "لحن بازنویسی پرانرژی، هیجان‌انگیز، گیرا و مناسب شبکه‌های اجتماعی باشد. از تعبیرات جذاب خودرویی برای جلب کنجکاوی مخاطب استفاده کن، در عین حال به حقایق فنی خبر پایبند بمان.",
  },
  technical: {
    id: "technical",
    name: "فنی، تحلیلی و کارشناسی",
    badge: "تخصصی خودرو",
    description: "تمرکز عمیق روی مشخصات قوای محرکه، جعبه‌دنده، هندلینگ، ایمنی، مقایسه با رقبا و ارزش خرید خودرو.",
    sampleHeadline: "بررسی فنی پیشرانه توربوشارژ TGDi و هماهنگی با گیربکس ۷ سرعته دوکلاچه",
    sampleExcerpt: "بررسی منحنی گشتاور این پیشرانه در دور موتور ۱۷۵۰ نشان می‌دهد سیستم خنک‌کاری و اینترکولر بهینه‌تری نسبت به نسل قبل پیاده‌سازی شده است...",
    instruction: "لحن بازنویسی کارشناسی، دقیق و تخصصی باشد. روی مشخصات فنی موتور، گشتاور، گیربکس، ایمنی، استهلاک و ارزش خرید خودرو تمرکز کن و به خواننده دید کارشناسی بده.",
  },
  concise: {
    id: "concise",
    name: "ساده، روان و خلاصه (کپسولی)",
    badge: "مطالعه ۳۰ ثانیه‌ای",
    description: "جملات کوتاه، کلمات سرراست و شفاف، انتقال اصل پیام در چند ثانیه بدون کلمات پیچیده یا حاشیه.",
    sampleHeadline: "خلاصه مهم‌ترین تغییرات قیمت و موعد تحویل خودرو",
    sampleExcerpt: "خلاصه ماجرا: قیمت نهایی ۱۰ درصد افزایش یافته و تحویل خودروها از آذر آغاز می‌شود. مهم‌ترین شرط ثبت‌نام داشتن پلاک فعال نداشتن است...",
    instruction: "لحن بازنویسی بسیار روان، شفاف و ساده باشد. از جملات کوتاه و صریح استفاده کن تا کاربر بتواند در کمتر از ۳۰ ثانیه اصل خبر را به روشنی دریافت کند.",
  },
};

// ------------------------------------------------------------------
// پرامپت‌ها
// ------------------------------------------------------------------
export function buildSystemPrompt(tone: AITone = "formal"): string {
  const toneInfo = AI_TONES[tone] || AI_TONES.formal;
  return [
    "تو یک ویراستار ارشد و کارشناس تولید محتوای تخصصی خودرو به زبان فارسی برای رسانه AutoPulse هستی.",
    `سبک و لحن نگارش انتخابی: «${toneInfo.name}».`,
    `دستورالعمل لحن: ${toneInfo.instruction}`,
    "قوانین مهم:",
    "۱. فقط بر اساس اطلاعات داده‌شده در متن منبع کار کن؛ هرگز عدد، نام، مشخصات یا ادعای غیرواقعی ایجاد نکن.",
    "۲. پاسخ را «همیشه و صرفاً» به‌صورت یک شیء JSON استاندارد با ۳ کلید (rewritten_text, tg_caption, ig_caption) برگردان بدون هیچ توضیح اضافه‌ای.",
  ].join("\n");
}

export function buildUserPrompt(
  item: RawNewsItem,
  lengthHint: string,
  tone: AITone = "formal"
): string {
  const toneInfo = AI_TONES[tone] || AI_TONES.formal;
  return [
    `عنوان خبر: ${item.title}`,
    `متن/خلاصهٔ منبع: ${item.excerpt || "(بدون متن، فقط از عنوان استفاده کن)"}`,
    "",
    `وظیفه: با رعایت لحن «${toneInfo.name}»، این سه خروجی را به فارسی تولید کن:`,
    `1. "rewritten_text": یک پاراگراف خبری کامل، زنده و منسجم برای سایت، دقیقاً ${lengthHint} کاراکتر (۴ تا ۶ جمله کامل با زمینه، جزئیات مهم و نتیجه‌گیری).`,
    '2. "tg_caption": یک کپشن کوتاه و جذاب برای تلگرام (حداکثر ۲۲۰ کاراکتر)، با یک ایموجی مرتبط در ابتدا، مناسب فرمت Markdown.',
    '3. "ig_caption": یک کپشن برای اینستاگرام (حداکثر ۳۲۰ کاراکتر)، با ۳ تا ۵ هشتگ مرتبط فارسی در انتها.',
    "",
    "فقط و فقط یک شیء JSON معتبر با همین سه کلید برگردان.",
  ].join("\n");
}

export function buildRetryPrompt(
  item: RawNewsItem,
  previousLen: number,
  tone: AITone = "formal"
): string {
  const toneInfo = AI_TONES[tone] || AI_TONES.formal;
  const direction = previousLen > MAX_LEN ? "بلندتر" : "کوتاه‌تر";
  const needMore = previousLen < MIN_LEN;
  const fixLine = needMore
    ? `متن را گسترش بده تا به دست‌کم ${MIN_LEN} کاراکتر (هدف ${TARGET_LEN}) برسد؛ با رعایت لحن «${toneInfo.name}»، جمله‌ها را کامل‌تر و با جزئیات بیشتری بنویس.`
    : `متن را کوتاه کن تا زیر ${MAX_LEN} کاراکتر بیفتد (هدف ${TARGET_LEN})؛ به همان حالت جمله‌ای و روان برس.`;
  return [
    `عنوان خبر: ${item.title}`,
    `متن/خلاصهٔ منبع: ${item.excerpt || "(بدون متن)"}`,
    "",
    `بازنویسی قبلی ${previousLen} کاراکتر بود و ${direction} از حد مجاز (${MIN_LEN} تا ${MAX_LEN}) است.`,
    fixLine,
    'فقط یک شیء JSON معتبر با کلیدهای rewritten_text، tg_caption و ig_caption برگردان.',
  ].join("\n");
}


// ------------------------------------------------------------------
// فراخوانی مدل + پارس JSON
// ------------------------------------------------------------------
export async function callModel(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 2500,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const isQuotaError =
      res.status === 429 ||
      res.status === 402 ||
      res.status === 403 ||
      /quota|credit|insufficient|balance|rate limit|resource_exhausted|token limit|exceeded/i.test(body);

    if (isQuotaError) {
      throw new Error(
        `AI_QUOTA_EXCEEDED: سهمیه یا توکن اعتبار API هوش مصنوعی به پایان رسیده است (${res.status}). لطفاً منتظر شارژ سهمیه بمانید یا کلید جدید اضافه کنید.`
      );
    }

    throw new Error(`NVIDIA API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA API returned empty content.");
  return content;
}

/** استخراج شیء JSON از خروجی مدل (که ممکن است داخل ```json ... ``` باشد). */
function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    return raw.slice(start, end + 1);
  }
  return raw.trim();
}

function parseContent(raw: string): AIGeneratedContent {
  const parsed = JSON.parse(extractJson(raw)) as Partial<AIGeneratedContent>;
  const rewritten = String(parsed.rewritten_text ?? "").trim();
  const tg = String(parsed.tg_caption ?? "").trim();
  const ig = String(parsed.ig_caption ?? "").trim();
  if (!rewritten) throw new Error("AI response missing rewritten_text.");
  return {
    rewritten_text: rewritten,
    tg_caption: tg,
    ig_caption: ig,
  };
}

/** کوتاه کردن ملایم متن بلند تا نزدیک‌ترین جملهٔ کامل ≤ MAX_LEN. */
function trimToMax(text: string): string {
  if (text.length <= MAX_LEN) return text;
  const slice = text.slice(0, MAX_LEN);
  const lastStop = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("۔"), // نقطهٔ فارسی
    slice.lastIndexOf("!"),
    slice.lastIndexOf("؟")
  );
  // اگر نقطهٔ منطقی پیدا شد و خیلی کوتاه نشد، همان‌جا ببر
  if (lastStop > MIN_LEN) return slice.slice(0, lastStop + 1);
  return slice; // آخرین چاره
}



// ------------------------------------------------------------------
// API عمومی
// ------------------------------------------------------------------
/**
 * تولید محتوای کامل برای یک خبر، با اعتبارسنجی طول.
 *
 * استراتژی (مقاوم در برابر مدل‌های reasoning که دقیق نمی‌شمارند):
 *   - اگر متن بلند بود → با trimToMax به نزدیک‌ترین جملهٔ کامل ≤ MAX برش می‌دهیم (قابل‌اعتماد).
 *   - اگر متن کوتاه بود → از مدل می‌خواهیم گسترش دهد (تا حداکثر ۳ تلاش).
 * طول نهایی همیشه بین MIN و MAX است، مگر اینکه مدل کوتاه تولید کند و کل تلاش‌ها fail شوند.
 */
const MAX_ATTEMPTS = 3;

export async function generateContent(
  item: RawNewsItem,
  tone: AITone = "formal"
): Promise<AIGeneratedContent> {
  const lengthHint = `بین ${MIN_LEN} تا ${MAX_LEN} کاراکتر (هدف ~${TARGET_LEN})`;

  let current = parseContent(
    await callModel(buildSystemPrompt(tone), buildUserPrompt(item, lengthHint, tone))
  );

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    const len = current.rewritten_text.length;

    // در بازهٔ مجاز → تمام
    if (len >= MIN_LEN && len <= MAX_LEN) {
      return current;
    }

    // بلند بود → برش معتبر و برگردان (نیازی به فراخوانی دوبارهٔ مدل نیست)
    if (len > MAX_LEN) {
      console.log(`[ai] attempt ${attempt}: ${len} chars → trimming to <=${MAX_LEN}`);
      return { ...current, rewritten_text: trimToMax(current.rewritten_text) };
    }

    // کوتاه بود → از مدل گسترش بخواه
    console.warn(`[ai] attempt ${attempt}: ${len} chars (too short); asking model to expand...`);
    current = parseContent(
      await callModel(buildSystemPrompt(tone), buildRetryPrompt(item, len, tone))
    );
  }

  // آخرین بررسی پس از آخرین تلاش
  const finalLen = current.rewritten_text.length;
  if (finalLen >= MIN_LEN && finalLen <= MAX_LEN) {
    return current;
  }
  if (finalLen > MAX_LEN) {
    return { ...current, rewritten_text: trimToMax(current.rewritten_text) };
  }

  throw new Error(
    `AI could not reach ${MIN_LEN}-${MAX_LEN} chars after ${MAX_ATTEMPTS} attempts (last: ${finalLen}).`
  );
}



