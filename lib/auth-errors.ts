/** Safe messages shared by Firebase REST and browser authentication. */
export function authErrorMessage(code: string) {
  const normalized = code.trim().replace(/^auth\//i, "").split(/\s*:\s*/u)[0].replaceAll("-", "_").toUpperCase();
  switch (normalized) {
    case "INVALID_LOGIN_CREDENTIALS": case "INVALID_CREDENTIAL": case "EMAIL_NOT_FOUND": case "USER_NOT_FOUND": case "INVALID_PASSWORD": case "WRONG_PASSWORD":
      return "We couldn't sign in with that email and portal password. Create an account first if you're new, or reset your portal password. Your UT EID password does not automatically work here. If you registered with Google, use Continue with Google.";
    case "EMAIL_EXISTS": case "EMAIL_ALREADY_IN_USE":
      return "An account already exists for this email. Sign in or reset your password.";
    case "USER_DISABLED": return "This account has been disabled. Contact the recruiting team.";
    case "TOO_MANY_ATTEMPTS_TRY_LATER": case "TOO_MANY_REQUESTS": return "Too many attempts. Please wait and try again.";
    case "INVALID_EMAIL": case "MISSING_EMAIL": return "Enter a valid UT Austin email address (@utexas.edu or @my.utexas.edu).";
    case "MISSING_PASSWORD": return "Enter the password you chose for this portal.";
    case "WEAK_PASSWORD": return "Choose a stronger password with at least 12 characters.";
    case "PASSWORD_DOES_NOT_MEET_REQUIREMENTS": return "Choose a stronger password with at least 12 characters, uppercase and lowercase letters, a number, and a symbol.";
    case "EXPIRED_OOB_CODE": case "INVALID_OOB_CODE": return "This email link is invalid or expired. Request a new link.";
    case "OPERATION_NOT_ALLOWED": case "PASSWORD_LOGIN_DISABLED": return "This sign-in method is unavailable. Contact the recruiting team.";
    case "POPUP_CLOSED_BY_USER": case "CANCELLED_POPUP_REQUEST": return "Google sign-in was cancelled. Please try again.";
    case "POPUP_BLOCKED": return "Allow popups for this site, then try Google sign-in again.";
    case "UNAUTHORIZED_DOMAIN": return "Google sign-in is not configured for this website. Contact the recruiting team.";
    case "ACCOUNT_EXISTS_WITH_DIFFERENT_CREDENTIAL": return "This email already uses another sign-in method. Use the method you originally used, or reset your portal password.";
    case "API_KEY_INVALID": case "INVALID_API_KEY": case "APP_NOT_AUTHORIZED": case "CONFIGURATION_NOT_FOUND": case "PROJECT_NOT_FOUND":
      return "Firebase sign-in configuration is incomplete or invalid. Contact the recruiting team.";
    case "INVALID_CONTINUE_URI": case "UNAUTHORIZED_CONTINUE_URI": case "MISSING_CONTINUE_URI":
      return "The email return link is not configured for this website. Contact the recruiting team.";
    case "INVALID_ID_TOKEN": case "TOKEN_EXPIRED": case "USER_TOKEN_EXPIRED": case "CREDENTIAL_TOO_OLD_LOGIN_AGAIN": case "REQUIRES_RECENT_LOGIN":
      return "Your sign-in credential has expired or is invalid. Sign in again and retry.";
    case "MFA_REQUIRED": case "MULTI_FACTOR_AUTH_REQUIRED":
      return "This account requires an additional verification step that this portal does not support yet. Contact the recruiting team for help signing in.";
    case "NETWORK_REQUEST_FAILED": return "Unable to connect. Check your connection and try again.";
    default: return "We couldn't complete authentication. Please try again.";
  }
}

export class FirebaseIdentityError extends Error {
  constructor(public readonly code: string) { super(authErrorMessage(code)); }
}
