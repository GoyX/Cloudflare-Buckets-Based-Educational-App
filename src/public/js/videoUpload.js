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

  let done = 0;
  for (let i = 0; i < uploadable.length; i++) {
    const relativePath = relativePaths[i];
    const url = presignData.urls[relativePath];
    if (!url) throw new Error(`لا يوجد رابط رفع للملف: ${relativePath}`);

    let putRes;
    try {
      putRes = await fetch(url, { method: "PUT", body: uploadable[i] });
    } catch (networkErr) {
      console.error(
        `[videoUpload] PUT to R2 failed before reaching R2 (file: ${relativePath}, url: ${url}):`,
        networkErr,
      );
      throw new Error(
        `تعذر الاتصال بـ R2 مباشرة أثناء رفع "${relativePath}". ` +
          `هذا يحدث غالباً بسبب عدم إعداد CORS على الـ bucket، أو أن أصل الموقع (origin) ` +
          `الحالي (${window.location.origin}) غير مطابق تماماً لما هو مُدرَج في إعدادات CORS.`,
      );
    }
    if (!putRes.ok) {
      let detail = "";
      try {
        detail = await putRes.text();
      } catch {}
      console.error(
        `[videoUpload] R2 rejected the upload (file: ${relativePath}, status: ${putRes.status}):`,
        detail,
      );
      throw new Error(
        `رفض R2 رفع الملف "${relativePath}" (${putRes.status}) — تأكد من صلاحية بيانات اعتماد R2 في .env`,
      );
    }

    done++;
    if (onProgress) onProgress(done, uploadable.length);
  }

  return manifest;
}
