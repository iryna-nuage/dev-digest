import { IMPORT_EXTENSIONS, IMPORT_MAX_BYTES } from "./constants";

/** Instant client-side check; the server stays authoritative. Returns an `import.*` i18n key. */
export function checkImportFile(file: Pick<File, "name" | "size">): "wrongType" | "tooLarge" | undefined {
  const lower = file.name.toLowerCase();
  if (!IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext))) return "wrongType";
  if (file.size > IMPORT_MAX_BYTES) return "tooLarge";
  return undefined;
}

/** File → base64 (without the `data:…;base64,` prefix). */
export function readAsBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result ?? "");
      resolve(url.slice(url.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
