// Fetch wrapper with a consistent error-shape contract with the backend;
// relies on the session cookie for auth (no token/header logic needed).
export async function api(path, options = {}, t) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: t("toast.requestError") };
  }
  if (!response.ok) throw new Error(data.error || t("toast.requestError"));
  return data;
}
