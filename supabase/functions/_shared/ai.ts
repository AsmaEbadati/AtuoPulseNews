// فاز ۳ — تولید محتوا با AI (NVIDIA NIM) — پورت lib/ai.ts
// خروجی: یک فراخوانی با JSON شامل rewritten_text + tg_caption + ig_caption

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";
const MIN_LEN = 900;
const MAX_LEN = 1100;
const TARGET_LEN = 1000;
const MAX_ATTEMPTS = 3;

export const isAIConfigured = Boolean(Deno.env.get("NVIDIA_API_KEY"));

function getApiKey(): string {
  const key = Deno.env.get("NVIDIA_API_KEY");
  if (!key) throw new Error("NVIDIA_API_KEY is not configured.");
  return key;
}

function getModel(): string {
  return Deno.env.get("NVIDIA_API_MODEL") || DEFAULT_MODEL;
}

export interface AiInput {
  title: string;
  excerpt: string; // متن کامل خبر (یا زیرنویس به‌عنوان fallback)
}

export interface AIGeneratedContent {
  rewritten_text: string;
  tg_caption: string;
  ig_caption: string;
}

function buildSystemPrompt(): string {
  return [
    "تو یک ویراستار حرفه‌ای خبری فارسی‌زبان هستی.",
    "وظیفه‌ات بازنویسی یک خبر خودرو به فارسی روان، رسمی و دقیق است.",
    "فقط بر اساس اطلاعات داده‌شده کار کن؛ هیچ عدد، نام یا ادعای جدید نساز.",
    "پاسخ را «همیشه» به‌صورت یک شیء JSON معتبر با سه کلید زیر برگردان و هیچ توضیح اضافه‌ای نده.",
  ].join(" ");
}

function buildUserPrompt(item: AiInput, lengthHint: string): string {
  return [
    `عنوان خبر: ${item.title}`,
    `متن/خلاصهٔ منبع: ${item.excerpt || "(بدون متن، فقط از عنوان استفاده کن)"}`,
    "",
    "این سه خروجی را به فارسی تولید کن:",
    `1. "rewritten_text": یک پاراگراف خبری کامل و زنده، دقیقاً ${lengthHint} کاراکتر.`,
    "   برای رسیدن به این طول، ۴ تا ۶ جمله بنویس و به‌طور طبیعی بسط بده (زمینه، جزئیات مهم، نتیجه‌گیری).",
    '2. "tg_caption": یک کپشن کوتاه و جذاب برای تلگرام (حداکثر ۲۰۰ کاراکتر)، با یک ایموجی مرتبط در ابتدا، مناسب فرمت Markdown.',
    '3. "ig_caption": یک کپشن برای اینستاگرام (حداکثر ۳۰۰ کاراکتر)، با ۳ تا ۵ هشتگ مرتبط فارسی در انتها.',
    "",
    "فقط و فقط یک شیء JSON معتبر با همین سه کلید برگردان.",
  ].join("\n");
}

function buildRetryPrompt(item: AiInput, previousLen: number): string {
  const needMore = previousLen < MIN_LEN;
  const fixLine = needMore
    ? `متن را گسترش بده تا به دست‌کم ${MIN_LEN} کاراکتر (هدف ${TARGET_LEN}) برسد؛ جمله‌ها را کامل‌تر و با جزئیات بیشتری بنویس.`
    : `متن را کوتاه کن تا زیر ${MAX_LEN} کاراکتر بیفتد (هدف ${TARGET_LEN})؛ به همان حالت جمله‌ای و روان برس.`;
  return [
    `عنوان خبر: ${item.title}`,
    `متن/خلاصهٔ منبع: ${item.excerpt || "(بدون متن)"}`,
    "",
    `بازنویسی قبلی ${previousLen} کاراکتر بود و ${previousLen > MAX_LEN ? "بلندتر" : "کوتاه‌تر"} از حد مجاز (${MIN_LEN} تا ${MAX_LEN}) است.`,
    fixLine,
    'فقط یک شیء JSON معتبر با کلیدهای rewritten_text، tg_caption و ig_caption برگردان.',
  ].join("\n");
}

async function callModel(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch(NVIDIA_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`NVIDIA API error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as any;
  const content: string | undefined = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("NVIDIA API returned empty content.");
  return content;
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return raw.slice(start, end + 1);
  return raw.trim();
}

function parseContent(raw: string): AIGeneratedContent {
  const parsed = JSON.parse(extractJson(raw)) as Partial<AIGeneratedContent>;
  const rewritten = String(parsed.rewritten_text ?? "").trim();
  const tg = String(parsed.tg_caption ?? "").trim();
  const ig = String(parsed.ig_caption ?? "").trim();
  if (!rewritten) throw new Error("AI response missing rewritten_text.");
  return { rewritten_text: rewritten, tg_caption: tg, ig_caption: ig };
}

function trimToMax(text: string): string {
  if (text.length <= MAX_LEN) return text;
  const slice = text.slice(0, MAX_LEN);
  const lastStop = Math.max(
    slice.lastIndexOf("."),
    slice.lastIndexOf("۔"),
    slice.lastIndexOf("!"),
    slice.lastIndexOf("؟")
  );
  if (lastStop > MIN_LEN) return slice.slice(0, lastStop + 1);
  return slice;
}

export async function generateContent(item: AiInput): Promise<AIGeneratedContent> {
  const lengthHint = `بین ${MIN_LEN} تا ${MAX_LEN} کاراکتر (هدف ~${TARGET_LEN})`;

  let current = parseContent(
    await callModel(buildSystemPrompt(), buildUserPrompt(item, lengthHint))
  );

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    const len = current.rewritten_text.length;
    if (len >= MIN_LEN && len <= MAX_LEN) return current;
    if (len > MAX_LEN) {
      console.log(`[ai] attempt ${attempt}: ${len} chars → trimming to <=${MAX_LEN}`);
      return { ...current, rewritten_text: trimToMax(current.rewritten_text) };
    }
    console.warn(`[ai] attempt ${attempt}: ${len} chars (too short); asking model to expand...`);
    current = parseContent(
      await callModel(buildSystemPrompt(), buildRetryPrompt(item, len))
    );
  }

  const finalLen = current.rewritten_text.length;
  if (finalLen >= MIN_LEN && finalLen <= MAX_LEN) return current;
  if (finalLen > MAX_LEN) return { ...current, rewritten_text: trimToMax(current.rewritten_text) };

  throw new Error(
    `AI could not reach ${MIN_LEN}-${MAX_LEN} chars after ${MAX_ATTEMPTS} attempts (last: ${finalLen}).`
  );
}
