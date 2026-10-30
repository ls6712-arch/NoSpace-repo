/**
 * Which way this device last logged in: with an emailed code or with a
 * password. The log in screen shows that one first. Kept on the device only.
 */
export type LoginMethod = "code" | "password";
const KEY = "soosh.login.method";

export function readLoginMethod(): LoginMethod {
  try {
    return localStorage.getItem(KEY) === "password" ? "password" : "code";
  } catch {
    return "code";
  }
}

export function rememberLoginMethod(method: LoginMethod): void {
  try {
    localStorage.setItem(KEY, method);
  } catch {
    // Without it the code comes first, which is the default anyway.
  }
}
