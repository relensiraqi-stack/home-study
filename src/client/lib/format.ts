export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Sends a file to one of the app's file routes; throws the refusal. */
export async function uploadFile(url: string, file: File): Promise<void> {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": file.type || "application/octet-stream",
      "x-file-name": encodeURIComponent(file.name),
    },
    body: file,
  });
  if (!response.ok) throw new Error((await response.text()) || "The upload failed.");
}

export async function removeFile(url: string): Promise<void> {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new Error((await response.text()) || "That didn't work.");
}
