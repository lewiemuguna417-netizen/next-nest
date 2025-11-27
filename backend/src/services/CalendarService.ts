import { google } from 'googleapis';

export interface CalendarEventOptions {
  summary: string;
  description: string;
  startTime: string;
  endTime: string;
  attendees?: string[];
  eventId?: string;
}

export class CalendarService {
  private static calendar = google.calendar('v3');
  
  // Initialize auth only if credentials are available
  private static getAuth() {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    
    if (!serviceAccountEmail || !serviceAccountKey) {
      throw new Error('Google Service Account credentials not configured');
    }
    
    return new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccountEmail,
        private_key: serviceAccountKey?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events'],
    });
  }

  static async createEvent(options: CalendarEventOptions): Promise<string | null> {
    try {
      const auth = this.getAuth();
      const authClient = await auth.getClient();
      google.options({ auth: authClient as any });

      const event = {
        summary: options.summary,
        description: options.description,
        start: {
          dateTime: options.startTime,
          timeZone: 'UTC',
        },
        end: {
          dateTime: options.endTime,
          timeZone: 'UTC',
        },
        attendees: options.attendees?.map(email => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 24 hours before
            { method: 'popup', minutes: 30 }, // 30 minutes before
          ],
        },
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendNotifications: true,
      });

      const eventId = response.data.id;
      console.log(`Calendar event created: ${eventId}`);
      return eventId || null;
    } catch (error) {
      console.error('Error creating calendar event:', error);
      return null;
    }
  }

  static async updateEvent(eventId: string, options: Partial<CalendarEventOptions>): Promise<boolean> {
    try {
      const auth = this.getAuth();
      const authClient = await auth.getClient();
      google.options({ auth: authClient as any });

      const updateData: any = {};
      
      if (options.summary) updateData.summary = options.summary;
      if (options.description) updateData.description = options.description;
      if (options.startTime) {
        updateData.start = {
          dateTime: options.startTime,
          timeZone: 'UTC',
        };
      }
      if (options.endTime) {
        updateData.end = {
          dateTime: options.endTime,
          timeZone: 'UTC',
        };
      }

      await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updateData,
        sendNotifications: true,
      });

      console.log(`Calendar event updated: ${eventId}`);
      return true;
    } catch (error) {
      console.error('Error updating calendar event:', error);
      return false;
    }
  }

  static async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const auth = this.getAuth();
      const authClient = await auth.getClient();
      google.options({ auth: authClient as any });

      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendNotifications: true,
      });

      console.log(`Calendar event deleted: ${eventId}`);
      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      return false;
    }
  }

  static async createAppointmentEvent(
    name: string,
    email: string,
    appointmentDateTime: string,
    notes?: string
  ): Promise<string | null> {
    const startTime = new Date(appointmentDateTime);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration

    const options: CalendarEventOptions = {
      summary: `Appointment with ${name}`,
      description: `
        Appointment Details:
        Name: ${name}
        Email: ${email}
        ${notes ? `Notes: ${notes}` : ''}
        
        Scheduled via PAXFORM
      `.trim(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: [email],
    };

    return this.createEvent(options);
  }
}