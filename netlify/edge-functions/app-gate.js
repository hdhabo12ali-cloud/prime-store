// يشتغل قبل أي شي ثاني (قبل الملفات الثابتة وقبل الـ functions).
// يمنع أي طلب ما فيه هيدر x-app-key الصحيح — يعني المتصفح العادي ما يشوف شي.
// البرنامج (Electron) هو الوحيد اللي يرسل هذا الهيدر تلقائيًا مع كل طلب (شوف main.js).

export default async (request, context) => {
  const secret = context.env.get("DESKTOP_APP_SECRET");

  // لو ما ضبطنا السر أصلاً بمتغيرات البيئة، ما نقفل الموقع بالغلط —
  // نخليه مفتوح عادي (نفس سلوك ما قبل ما نضيف هالميزة).
  if (!secret) {
    return context.next();
  }

  const provided = request.headers.get("x-app-key");
  if (provided === secret) {
    return context.next();
  }

  return new Response(
    `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>غير متاح</title>
    <meta name="robots" content="noindex, nofollow">
    <style>body{background:#0a0a0b;color:#9c9a96;font-family:system-ui,sans-serif;height:100vh;margin:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px}</style>
    </head><body><p>هذا المحتوى متاح فقط عبر تطبيق سطح المكتب الرسمي.</p></body></html>`,
    {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex, nofollow" },
    }
  );
};

export const config = {
  path: "/*",
  excludedPath: ["/.netlify/*"],
};
