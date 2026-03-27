/**
 * Utility for generating a 6-character alphanumeric verification code
 */

/**
 * Generates a random 6-character alphanumeric verification code
 * @returns {string} 6-character code (uppercase letters and digits)
 */
const generateVerificationCode = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

module.exports = { generateVerificationCode };
