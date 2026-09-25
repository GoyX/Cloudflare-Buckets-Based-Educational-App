const EXCLUDED_UPLOAD_FILENAMES = new Set([
  "manifest.json",
  "enc.key",
  "keyinfo.txt",
]);

async function uploadEncodedVideo(fileList, { onProgress } = {}) {
  const files = Array.from(fileList);
  if (files.length === 0) {
    throw new Error("لم يتم اختيار أي ملفات");
  }

  const manifestFile = files.find((f) => f.name === "manifest.json");
  if (!manifestFile) {
    throw new Error(
      "لم يتم العثور على manifest.json — تأكد من اختيار مجلد الفيديو الناتج عن سكربت الترميز",
    );
  }

  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.text());
  } catch {
    throw new Error("ملف manifest.json غير صالح");
  }
  if (
    !manifest.videoId ||
    !manifest.keyHex ||
    !Array.isArray(manifest.qualities)
  ) {
    throw new Error("ملف manifest.json غير مكتمل");
  }

  const topFolder = manifestFile.webkitRelativePath.split("/")[0];
  const uploadable = files.filter(
    (f) => !EXCLUDED_UPLOAD_FILENAMES.has(f.name),
  );
  const relativePaths = uploadable.map((f) =>
    f.webkitRelativePath.slice(topFolder.length + 1),
  );

  const presignBody = JSON.stringify({
    videoId: manifest.videoId,
    files: relativePaths,
  });
  let presignRes;
  try {
    presignRes = await fetch("/admin/videos/upload-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: presignBody,
    });
  } catch (networkErr) {
    console.error(
      "[videoUpload] presign request failed before reaching the server:",
      networkErr,
    );
    throw new Error(
      "تعذر الاتصال بالخادم — تأكد أن السيرفر يعمل، ثم أعد المحاولة",
    );
  }

  let presignData;
  try {
    presignData = await presignRes.json();
  } catch {
    throw new Error(`استجابة غير متوقعة من الخادم (${presignRes.status})`);
  }
  if (!presignRes.ok) {
    throw new Error(presignData.error || "فشل توليد روابط الرفع");
  }

  async function resignOne(relativePath) {
    const res = await fetch("/admin/videos/upload-urls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: manifest.videoId, files: [relativePath] }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.urls?.[relativePath]) {
      throw new Error(data?.error || "فشل تجديد رابط الرفع");
    }
    return data.urls[relativePath];
  }

  const MAX_ATTEMPTS = 3;
  const CONCURRENCY = 6;

  async function uploadOne(i) {
    const relativePath = relativePaths[i];
    let url = presignData.urls[relativePath];
    if (!url) throw new Error(`لا يوجد رابط رفع للملف: ${relativePath}`);

    let lastStatusErr = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        try {
          url = await resignOne(relativePath);
        } catch (resignErr) {
          console.error(
            `[videoUpload] failed to re-sign URL for ${relativePath}:`,
            resignErr,
          );
        }
      }

      let putRes;
      try {
        putRes = await fetch(url, { method: "PUT", body: uploadable[i] });
      } catch (networkErr) {
        console.warn(
          `[videoUpload] PUT to R2 failed before reaching R2 (file: ${relativePath}, attempt: ${attempt}):`,
          networkErr,
        );
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `تعذر الاتصال بـ R2 أثناء رفع "${relativePath}" بعد ${MAX_ATTEMPTS} محاولات. ` +
              `هذا يحدث غالباً بسبب عدم إعداد CORS على الـ bucket، أو أن أصل الموقع (origin) ` +
              `الحالي (${window.location.origin}) غير مطابق تماماً لما هو مُدرَج في إعدادات CORS.`,
          );
        }
        continue;
      }

      if (!putRes.ok) {
        let detail = "";
        try {
          detail = await putRes.text();
        } catch {}
        lastStatusErr = { status: putRes.status, detail };
        console.warn(
          `[videoUpload] R2 rejected the upload (file: ${relativePath}, status: ${putRes.status}, attempt: ${attempt}):`,
          detail,
        );
        if (attempt === MAX_ATTEMPTS) {
          throw new Error(
            `رفض R2 رفع الملف "${relativePath}" (${lastStatusErr.status}) بعد ${MAX_ATTEMPTS} محاولات — ` +
              `إذا كانت الحالة 403 فالسبب الأرجح انتهاء صلاحية رابط الرفع الموقّع أثناء رفع مجلد كبير، ` +
              `وإلا تأكد من صلاحية بيانات اعتماد R2 في .env`,
          );
        }
        continue;
      }

      return;
    }
  }

  let done = 0;
  let nextIndex = 0;
  let firstError = null;

  async function worker() {
    while (firstError === null) {
      const i = nextIndex++;
      if (i >= uploadable.length) return;
      try {
        await uploadOne(i);
        done++;
        if (onProgress) onProgress(done, uploadable.length);
      } catch (err) {
        if (firstError === null) firstError = err;
        return;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, uploadable.length) },
    () => worker(),
  );
  await Promise.all(workers);

  if (firstError) throw firstError;

  return manifest;
}
