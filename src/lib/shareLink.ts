/**
 * Copies text to the clipboard; if the browser blocks that (or the site is not on https, or it is an in-app browser) uses the
 * older copy command. Returns whether it REALLY copied, so a screen never claims "Copied" when nothing was copied.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(box);
      return ok;
    } catch {
      return false;
    }
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
  return (await copyText(`${data.text} ${data.url}`)) ? "copied" : "cancelled";
}
