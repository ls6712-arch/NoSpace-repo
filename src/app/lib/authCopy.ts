import { formatWait } from "./dates";

/** Shown instead of an error when too many codes were asked for: a wait, with how long. */
export const codeWaitLine = (seconds: number) => `You can ask for another code in ${formatWait(seconds)}.`;

/**
 * The one message for every way a log in with a password can fail: an email
 * with no account, a wrong password, an account that has no password. It must
 * never say which, so nobody can use the form to find out who has an account.
 */
export const WRONG_LOGIN_LINE = "That email and password don’t match.";

/** The forgot-password confirmation. It reads the same whether or not the address has an account. */
export const resetSentLine = (email: string) => `If there’s an account for ${email}, we’ve sent a link.`;

/**
 * The hourly cap on codes, which has no time to give. On log in the way out is the password;
 * sign-up has no password to offer, so it leaves that clause off.
 */
export const TOO_MANY_CODES_LINE = "Too many codes for now. Try again in a little while, or log in with your password.";
export const TOO_MANY_CODES_SIGNUP_LINE = "Too many codes for now. Try again in a little while.";
