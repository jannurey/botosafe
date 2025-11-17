// lib/nodemailer.ts
import nodemailer from "nodemailer";

// Check if email configuration exists
const hasEmailConfig = process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS;

let transporter: nodemailer.Transporter;

if (hasEmailConfig) {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for 587
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
} else {
  // Fallback transporter that logs to console and simulates email sending
  transporter = {
    sendMail: async (mailOptions: nodemailer.SendMailOptions) => {
      // Always log OTP in development mode
      if (process.env.NODE_ENV !== "production") {
        // Extract OTP from the email content if present
        const textContent = mailOptions.text?.toString() || '';
        const otpMatch = textContent.match(/\b\d{6}\b/);
        if (otpMatch) {
          console.log("📧 DEVELOPMENT MODE - OTP Code:", otpMatch[0]);
          console.log("📧 Email would be sent to:", mailOptions.to);
        } else {
          console.log("📧 DEVELOPMENT MODE - EMAIL CONTENT:");
          console.log("To:", mailOptions.to);
          console.log("Subject:", mailOptions.subject);
          console.log("Text:", textContent);
        }
        console.log("---");
      }
      
      // Return a mock response to simulate successful email sending
      return { messageId: "mock-message-id" };
    }
  } as unknown as nodemailer.Transporter;
}

export default transporter;