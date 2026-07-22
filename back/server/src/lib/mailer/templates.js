/**
 * Email templates. Each builder returns { subject, html, text } for sendMail().
 * Kept intentionally simple (inline styles, no external assets) so they render
 * in any client and need no build step.
 */

const APP_NAME = process.env.APP_NAME || "Template";

const layout = (title, bodyHtml) => `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
    <h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">${title}</h1>
    ${bodyHtml}
    <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 28px 0 16px;" />
    <p style="font-size: 12px; color: #a1a1aa; margin: 0;">${APP_NAME} · This is an automated message, please do not reply.</p>
  </div>
`;

const button = (href, label) => `
  <a href="${href}" style="display: inline-block; background: #18181b; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 11px 20px; border-radius: 8px;">${label}</a>
`;

/**
 * Password reset email.
 * @param {{ name?: string, resetUrl: string, expiresMinutes: number }} p
 */
export const passwordResetEmail = ({ name, resetUrl, expiresMinutes }) => ({
  subject: `Reset your ${APP_NAME} password`,
  html: layout(
    "Reset your password",
    `
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
      ${name ? `Hi ${name},` : "Hi,"} we received a request to reset your password.
      Click the button below to choose a new one. This link expires in
      ${expiresMinutes} minutes.
    </p>
    <p style="margin: 0 0 20px;">${button(resetUrl, "Reset password")}</p>
    <p style="font-size: 13px; color: #71717a; line-height: 1.6; margin: 0;">
      If you didn't request this, you can safely ignore this email — your password
      won't change. If the button doesn't work, copy this link into your browser:<br />
      <span style="color: #16a34a; word-break: break-all;">${resetUrl}</span>
    </p>
  `
  ),
});

/**
 * Email-verification email (template ready for a future verify-email flow).
 * @param {{ name?: string, verifyUrl: string, expiresMinutes: number }} p
 */
export const verifyEmail = ({ name, verifyUrl, expiresMinutes }) => ({
  subject: `Verify your ${APP_NAME} email`,
  html: layout(
    "Verify your email",
    `
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
      ${name ? `Hi ${name},` : "Hi,"} confirm your email address to finish setting
      up your account. This link expires in ${expiresMinutes} minutes.
    </p>
    <p style="margin: 0 0 20px;">${button(verifyUrl, "Verify email")}</p>
    <p style="font-size: 13px; color: #71717a; word-break: break-all; margin: 0;">${verifyUrl}</p>
  `
  ),
});

/**
 * Team-invite email (template ready for a future invite flow).
 * @param {{ inviterName?: string, inviteUrl: string, companyName?: string }} p
 */
export const inviteEmail = ({ inviterName, inviteUrl, companyName }) => ({
  subject: `You've been invited to ${companyName || APP_NAME}`,
  html: layout(
    "You've been invited",
    `
    <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px;">
      ${inviterName ? `${inviterName} has` : "You've been"} invited you to join
      ${companyName ? `<strong>${companyName}</strong>` : APP_NAME}. Click below to
      accept and set up your account.
    </p>
    <p style="margin: 0 0 20px;">${button(inviteUrl, "Accept invite")}</p>
    <p style="font-size: 13px; color: #71717a; word-break: break-all; margin: 0;">${inviteUrl}</p>
  `
  ),
});
