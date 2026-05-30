import nodemailer from 'nodemailer';
import { logEmail, updateEmailLogStatus } from './db';

// Email transporter configuration
let transporter: nodemailer.Transporter | null = null;

export async function initializeEmailService() {
  try {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Verify connection
    await transporter.verify();
    console.log('Email service initialized successfully');
  } catch (error) {
    console.error('Error initializing email service:', error);
    // Don't throw - allow app to continue without email (will log errors when trying to send)
  }
}

export async function sendConfirmationEmail(
  userId: number,
  recipientEmail: string,
  userName: string,
  productName: string,
  downloadLink: string,
  purchaseId?: number
): Promise<boolean> {
  if (!transporter) {
    console.warn('Email transporter not initialized');
    return false;
  }

  const subject = `Your ${productName} Report is Ready to Download`;
  
  try {
    // Log email attempt in database
    const emailLog = await logEmail(userId, purchaseId || null, 'confirmation', recipientEmail, subject);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4f46e5; color: white; padding: 20px; border-radius: 5px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; margin: 20px 0; border-radius: 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { font-size: 12px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Wellness Report is Ready!</h1>
            </div>
            
            <div class="content">
              <p>Hi ${userName},</p>
              
              <p>Great news! Your personalized ${productName} report has been generated and is ready for download.</p>
              
              <p>Click the button below to access your report:</p>
              
              <center>
                <a href="${downloadLink}" class="button">Download Your Report</a>
              </center>
              
              <p>This link is unique to your account and will remain available for 30 days.</p>
              
              <h3>What's Inside Your Report:</h3>
              <ul>
                <li>Personalized wellness analysis based on your quiz responses</li>
                <li>Tailored nutrition and fitness recommendations</li>
                <li>Science-backed insights for your profile</li>
                <li>Actionable steps to optimize your health</li>
              </ul>
              
              <p><strong>Questions?</strong> Reply to this email or visit our support page.</p>
            </div>
            
            <div class="footer">
              <p>&copy; 2026 GeneWell. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Hi ${userName},

Great news! Your personalized ${productName} report has been generated and is ready for download.

Download your report here: ${downloadLink}

This link is unique to your account and will remain available for 30 days.

Questions? Reply to this email or visit our support page.

(c) 2026 GeneWell. All rights reserved.
    `;

    // Send email
    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    // Update email log with success
    await updateEmailLogStatus(emailLog.id, 'sent');
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    // Update email log with error
    if (await logEmail(userId, purchaseId || null, 'confirmation', recipientEmail, subject)) {
      const emailLog = await logEmail(userId, purchaseId || null, 'confirmation', recipientEmail, subject);
      await updateEmailLogStatus(emailLog.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    }
    return false;
  }
}

export async function sendPaymentConfirmationEmail(
  userId: number,
  recipientEmail: string,
  userName: string,
  planName: string,
  amount: number,
  transactionId: string,
  purchaseId?: number
): Promise<boolean> {
  if (!transporter) {
    console.warn('Email transporter not initialized');
    return false;
  }

  const subject = `Payment Confirmation - ${planName}`;

  try {
    const emailLog = await logEmail(userId, purchaseId || null, 'payment_confirmation', recipientEmail, subject);

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; border-radius: 5px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; margin: 20px 0; border-radius: 5px; }
            .details { background-color: white; padding: 15px; border-left: 4px solid #10b981; }
            .details-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .button { display: inline-block; padding: 12px 30px; background-color: #4f46e5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { font-size: 12px; color: #6b7280; text-align: center; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✓ Payment Successful</h1>
            </div>
            
            <div class="content">
              <p>Hi ${userName},</p>
              
              <p>Thank you for your purchase! Your payment has been successfully processed.</p>
              
              <div class="details">
                <div class="details-row">
                  <strong>Plan:</strong>
                  <span>${planName}</span>
                </div>
                <div class="details-row">
                  <strong>Amount Paid:</strong>
                  <span>₹${amount.toFixed(2)}</span>
                </div>
                <div class="details-row">
                  <strong>Transaction ID:</strong>
                  <span>${transactionId}</span>
                </div>
              </div>
              
              <p style="margin-top: 20px;">Your personalized report will be ready shortly. You'll receive another email with the download link.</p>
              
              <center>
                <a href="${process.env.APP_URL || 'https://genewell.com'}/dashboard" class="button">View Your Dashboard</a>
              </center>
              
              <p><strong>Need Help?</strong> Contact our support team at support@genewell.com</p>
            </div>
            
            <div class="footer">
              <p>&copy; 2026 GeneWell. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const textContent = `
Hi ${userName},

Thank you for your purchase! Your payment has been successfully processed.

Plan: ${planName}
Amount Paid: Rs.${amount.toFixed(2)}
Transaction ID: ${transactionId}

Your personalized report will be ready shortly. You'll receive another email with the download link.

Need help? Contact our support team at support@genewell.com

(c) 2026 GeneWell. All rights reserved.
    `;

    const info = await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: recipientEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    await updateEmailLogStatus(emailLog.id, 'sent');
    console.log('Payment confirmation email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending payment confirmation email:', error);
    const emailLog = await logEmail(userId, purchaseId || null, 'payment_confirmation', recipientEmail, subject);
    await updateEmailLogStatus(emailLog.id, 'failed', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export function isEmailServiceAvailable(): boolean {
  return !!transporter && !!process.env.GMAIL_USER && !!process.env.GMAIL_APP_PASSWORD;
}
