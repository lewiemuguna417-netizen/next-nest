import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private static FROM_EMAIL = process.env.SENDER_EMAIL || 'noreply@paxform.com';

  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const msg = {
        to: options.to,
        from: this.FROM_EMAIL,
        subject: options.subject,
        text: options.text || '',
        html: options.html,
      };

      await sgMail.send(msg);
      console.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  static async sendWelcomeEmail(to: string, name: string): Promise<boolean> {
    const subject = 'Welcome to PAXFORM - Account Created';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Welcome to PAXFORM!</h2>
        <p>Hello ${name},</p>
        <p>Your PAXFORM account has been created successfully. You can now access the admin dashboard to manage appointments.</p>
        <p>If you have any questions, please don't hesitate to contact our support team.</p>
        <br>
        <p>Best regards,<br>The PAXFORM Team</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html });
  }

  static async sendAppointmentConfirmation(
    to: string, 
    name: string, 
    appointmentDateTime: string, 
    appointmentId: string
  ): Promise<boolean> {
    const subject = 'Appointment Confirmation - PAXFORM';
    const formattedDate = new Date(appointmentDateTime).toLocaleString();
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Appointment Confirmed</h2>
        <p>Hello ${name},</p>
        <p>Your appointment has been successfully scheduled:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Date & Time:</strong> ${formattedDate}</p>
          <p><strong>Appointment ID:</strong> ${appointmentId}</p>
        </div>
        <p>We look forward to meeting with you!</p>
        <br>
        <p>Best regards,<br>The PAXFORM Team</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html });
  }

  static async sendAppointmentUpdate(
    to: string,
    name: string,
    appointmentDateTime: string,
    status: string,
    appointmentId: string
  ): Promise<boolean> {
    const subject = `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)} - PAXFORM`;
    const formattedDate = new Date(appointmentDateTime).toLocaleString();
    const statusColor = status === 'completed' ? '#16a34a' : status === 'cancelled' ? '#dc2626' : '#2563eb';
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${statusColor};">Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}</h2>
        <p>Hello ${name},</p>
        <p>Your appointment status has been updated:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Status:</strong> <span style="color: ${statusColor}; font-weight: bold;">${status.charAt(0).toUpperCase() + status.slice(1)}</span></p>
          <p><strong>Date & Time:</strong> ${formattedDate}</p>
          <p><strong>Appointment ID:</strong> ${appointmentId}</p>
        </div>
        <p>Thank you for using PAXFORM!</p>
        <br>
        <p>Best regards,<br>The PAXFORM Team</p>
      </div>
    `;

    return this.sendEmail({ to, subject, html });
  }
}