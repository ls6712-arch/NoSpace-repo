import { LoginV2 } from "./login/LoginV2";

/** /login: the Soosh log in (Transfer frame, codes first). Sign-up is /onboarding, which asks for a birthday. */
export function Login() {
  return <LoginV2 />;
}
