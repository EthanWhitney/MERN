import { buildPath } from "./config";

/**
 * Request a password reset code to be sent to the user's email
 * @param email - User's email address
 * @returns Promise with success status and error message if any
 */
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error: string }> {
  try {
    const obj = { email: email.toLowerCase() };
    const js = JSON.stringify(obj);

    const response = await fetch(buildPath('api/auth/request-password-reset'), {
      method: 'POST',
      body: js,
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await response.json();

    if (res.error && res.error.length > 0) {
      return { success: false, error: res.error };
    }

    return { success: res.success === true, error: '' };
  } catch (error: any) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Verify that a password reset code is valid
 * @param email - User's email address
 * @param code - 6-character password reset code
 * @returns Promise with success status and error message if any
 */
export async function verifyResetCode(email: string, code: string): Promise<{ success: boolean; error: string }> {
  try {
    const obj = { email: email.toLowerCase(), code };
    const js = JSON.stringify(obj);

    const response = await fetch(buildPath('api/auth/verify-reset-code'), {
      method: 'POST',
      body: js,
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await response.json();

    if (res.error && res.error.length > 0) {
      return { success: false, error: res.error };
    }

    return { success: res.success === true, error: '' };
  } catch (error: any) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Reset user password with a valid reset code
 * @param email - User's email address
 * @param code - 6-character password reset code
 * @param newPassword - New password
 * @returns Promise with success status and error message if any
 */
export async function resetPassword(
  email: string,
  code: string,
  newPassword: string
): Promise<{ success: boolean; error: string }> {
  try {
    const obj = { email: email.toLowerCase(), code, newPassword };
    const js = JSON.stringify(obj);

    const response = await fetch(buildPath('api/auth/reset-password'), {
      method: 'POST',
      body: js,
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await response.json();

    if (res.error && res.error.length > 0) {
      return { success: false, error: res.error };
    }

    return { success: res.success === true, error: '' };
  } catch (error: any) {
    return { success: false, error: error.toString() };
  }
}
