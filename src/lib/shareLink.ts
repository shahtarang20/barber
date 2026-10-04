/** Copies text to the clipboard; if the browser blocks that (or the site is not on https) uses the older copy command. */
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const box = document.createElement("textarea");
    box.value = text;
    document.body.appendChild(box);
    box.select();
    document.execCommand("copy");
    document.body.removeChild(box);
  }
}

/**
 * Opens the phone's own share sheet (WhatsApp, SMS, ...). Returns "shared", "cancelled" (the person closed the sheet),
 * or "copied" when there is no share sheet (some computers) or sharing failed, so the caller can say the link was copied.
 */
export async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<"shared" | "cancelled" | "copied"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return "cancelled";
    }
  }
  await copyText(`${data.text} ${data.url}`);
  return "copied";
}
