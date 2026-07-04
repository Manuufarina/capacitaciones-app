const { google } = require('googleapis');

const SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;
const TIME_ZONE = 'America/Argentina/Buenos_Aires';

function getCalendarClient() {
  const auth = new google.auth.JWT({
    email: SERVICE_ACCOUNT_EMAIL,
    key: PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  return google.calendar({ version: 'v3', auth });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!SERVICE_ACCOUNT_EMAIL || !PRIVATE_KEY || !CALENDAR_ID) {
    return res.status(501).json({ error: 'Google Calendar not configured' });
  }

  const { action, summary, description, location, date, time, durationMinutes, eventId } = req.body || {};

  try {
    const calendar = getCalendarClient();

    if (action === 'create') {
      if (!summary || !date || !time) {
        return res.status(400).json({ error: 'Missing parameters' });
      }
      const [year, month, day] = date.split('-').map(Number);
      const [hour, minute] = time.split(':').map(Number);
      const startUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
      const endUtc = new Date(startUtc.getTime() + (parseInt(durationMinutes, 10) || 120) * 60000);
      const pad = n => String(n).padStart(2, '0');
      const toLocalDateTime = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
      const response = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary,
          description: description || '',
          location: location || '',
          start: { dateTime: toLocalDateTime(startUtc), timeZone: TIME_ZONE },
          end: { dateTime: toLocalDateTime(endUtc), timeZone: TIME_ZONE },
        },
      });
      return res.status(200).json({ eventId: response.data.id });
    }

    if (action === 'delete') {
      if (!eventId) {
        return res.status(400).json({ error: 'Missing eventId' });
      }
      await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
      return res.status(200).json({ message: 'Event deleted' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (err) {
    console.error('Error with calendar operation', err);
    return res.status(500).json({ error: 'Calendar operation failed' });
  }
};
