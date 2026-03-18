import nodemailer from "nodemailer";
import { z } from "zod";

const smtpConfigSchema = z.object({
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.string().transform((val) => parseInt(val, 10)),
  SMTP_SECURE: z
    .string()
    .optional()
    .transform((val) => val === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().email(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
});

function getSmtpConfig() {
  const result = smtpConfigSchema.safeParse({
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT ?? "587",
    SMTP_SECURE: process.env.SMTP_SECURE,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    SMTP_FROM: process.env.SMTP_FROM,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (!result.success) {
    throw new Error(`Invalid SMTP configuration: ${result.error.message}`);
  }

  return result.data;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const config = getSmtpConfig();

  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  return transporter;
}

export interface SendInvitationEmailParams {
  to: string;
  recipientName: string;
  companyName: string;
  itbTitle: string;
  itbId: string;
  token: string;
  dueDate: Date;
  issuedBy: string;
}

export async function sendInvitationEmail(
  params: SendInvitationEmailParams,
): Promise<void> {
  const {
    to,
    recipientName,
    companyName,
    itbTitle,
    itbId,
    token,
    dueDate,
    issuedBy,
  } = params;

  const config = getSmtpConfig();
  const transport = getTransporter();

  const bidSubmissionUrl = `${config.NEXT_PUBLIC_APP_URL}/bids/submit?itbId=${encodeURIComponent(itbId)}&token=${encodeURIComponent(token)}`;

  const formattedDueDate = dueDate.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invitation to Bid</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: #1a3c5e;
      color: #ffffff;
      padding: 32px 40px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0;
      font-size: 14px;
      opacity: 0.85;
    }
    .body {
      padding: 32px 40px;
      color: #333333;
    }
    .body p {
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 16px;
    }
    .details-box {
      background-color: #f8f9fa;
      border-left: 4px solid #1a3c5e;
      border-radius: 4px;
      padding: 20px 24px;
      margin: 24px 0;
    }
    .details-box table {
      width: 100%;
      border-collapse: collapse;
    }
    .details-box td {
      padding: 6px 0;
      font-size: 14px;
    }
    .details-box td:first-child {
      font-weight: 600;
      color: #555555;
      width: 140px;
    }
    .cta-container {
      text-align: center;
      margin: 32px 0;
    }
    .cta-button {
      display: inline-block;
      background-color: #1a3c5e;
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .cta-button:hover {
      background-color: #14304d;
    }
    .link-fallback {
      font-size: 13px;
      color: #666666;
      word-break: break-all;
      margin-top: 12px;
    }
    .footer {
      background-color: #f4f4f4;
      padding: 20px 40px;
      text-align: center;
      font-size: 12px;
      color: #888888;
    }
    .footer a {
      color: #1a3c5e;
      text-decoration: none;
    }
    .warning {
      background-color: #fff8e1;
      border: 1px solid #ffe082;
      border-radius: 4px;
      padding: 12px 16px;
      font-size: 13px;
      color: #795548;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Invitation to Bid</h1>
      <p>You have been invited to submit a bid proposal</p>
    </div>
    <div class="body">
      <p>Dear ${recipientName},</p>
      <p>
        We are pleased to invite <strong>${companyName}</strong> to submit a bid for the following opportunity:
      </p>

      <div class="details-box">
        <table>
          <tr>
            <td>ITB Title:</td>
            <td><strong>${itbTitle}</strong></td>
          </tr>
          <tr>
            <td>Reference ID:</td>
            <td>${itbId}</td>
          </tr>
          <tr>
            <td>Issued By:</td>
            <td>${issuedBy}</td>
          </tr>
          <tr>
            <td>Submission Due:</td>
            <td><strong>${formattedDueDate}</strong></td>
          </tr>
        </table>
      </div>

      <p>
        To review the full bid details and submit your proposal, please click the button below.
        This link is unique to your invitation and should not be shared.
      </p>

      <div class="cta-container">
        <a href="${bidSubmissionUrl}" class="cta-button">View &amp; Submit Bid</a>
        <p class="link-fallback">
          If the button above does not work, copy and paste the following link into your browser:<br />
          <a href="${bidSubmissionUrl}">${bidSubmissionUrl}</a>
        </p>
      </div>

      <div class="warning">
        ⚠️ <strong>Important:</strong> This invitation link is valid only for your organization and expires on the bid submission due date.
        Please do not forward this email or share the link with unauthorized parties.
      </div>

      <p style="margin-top: 24px;">
        If you have any questions regarding this invitation, please contact the issuing organization directly.
      </p>

      <p>
        Best regards,<br />
        <strong>${issuedBy}</strong>
      </p>
    </div>
    <div class="footer">
      <p>
        This is an automated message. Please do not reply directly to this email.<br />
        &copy; ${new Date().getFullYear()} Procurement Portal. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();

  const textContent = `
Invitation to Bid

Dear ${recipientName},

You have been invited to submit a bid on behalf of ${companyName}.

ITB Details:
- Title: ${itbTitle}
- Reference ID: ${itbId}
- Issued By: ${issuedBy}
- Submission Due: ${formattedDueDate}

To view the full bid details and submit your proposal, visit the following link:
${bidSubmissionUrl}

IMPORTANT: This link is unique to your invitation. Do not share it with unauthorized parties.

If you have questions, please contact the issuing organization directly.

Best regards,
${issuedBy}
  `.trim();

  await transport.sendMail({
    from: config.SMTP_FROM,
    to,
    subject: `Invitation to Bid: ${itbTitle} [Ref: ${itbId}]`,
    text: textContent,
    html: htmlContent,
  });
}

export async function verifyTransporter(): Promise<boolean> {
  try {
    const transport = getTransporter();
    await transport.verify();
    return true;
  } catch {
    return false;
  }
}
