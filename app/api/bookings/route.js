import { google } from "googleapis";
import prisma from "../../../lib/prismadb";

// Convert a date string ("2026-03-15") + minutes-from-midnight (480) → Date
function slotToDate(dateStr, mins) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMinutes(d.getMinutes() + mins);
  return d;
}

async function createCalendarEvent({ producerEmail, startsAt, endsAt, title, description, attendeeEmails }) {
  const user = await prisma.user.findUnique({
    where: { email: producerEmail },
    include: { accounts: { where: { provider: "google" } } },
  });

  if (!user?.accounts[0]) return null;

  const account = user.accounts[0];

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials({
    access_token:  account.access_token,
    refresh_token: account.refresh_token,
    expiry_date:   account.expires_at ? account.expires_at * 1000 : undefined,
  });

  oauth2Client.on("tokens", async (tokens) => {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token,
        ...(tokens.refresh_token && { refresh_token: tokens.refresh_token }),
        ...(tokens.expiry_date && { expires_at: Math.floor(tokens.expiry_date / 1000) }),
      },
    });
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const event = await calendar.events.insert({
    calendarId: "primary",
    sendUpdates: "all", // Google sends email invites to all attendees
    requestBody: {
      summary: title,
      description,
      start: { dateTime: startsAt.toISOString() },
      end:   { dateTime: endsAt.toISOString() },
      attendees: attendeeEmails.map((email) => ({ email })),
    },
  });

  return event.data.id;
}

export async function POST(request) {
  const body = await request.json();
  const { clientName, clientEmail, clientBusiness, clientNote, producerEmails, shootType, duration, slot, startsAtOverride, endsAtOverride } = body;

  if (!clientName || !clientEmail || !producerEmails?.length || !slot) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const startsAt = startsAtOverride ? new Date(startsAtOverride) : slotToDate(slot.date, slot.shootStart);
  const endsAt   = endsAtOverride   ? new Date(endsAtOverride)   : slotToDate(slot.date, slot.shootEnd);

  const title = `${clientBusiness || clientName} | Shoot`;
  const description = [
    `Client: ${clientName} (${clientEmail})`,
    `Duration: ${duration} min`,
    clientNote ? `Notes: ${clientNote}` : null,
  ].filter(Boolean).join("\n");

  // All attendees: producers + client
  const attendeeEmails = [...producerEmails, clientEmail];

  // Save booking to DB
  const booking = await prisma.booking.create({
    data: {
      title,
      description,
      startsAt,
      endsAt,
      shootType,
      clientName,
      clientEmail,
      clientBusiness,
      clientNote,
      attendees: {
        create: attendeeEmails.map((email) => ({ email })),
      },
    },
  });

  // Create a calendar event on each producer's Google Calendar
  // (sendUpdates:"all" means Google emails everyone in the attendees list)
  const calendarResults = await Promise.allSettled(
    producerEmails.map((email) =>
      createCalendarEvent({ producerEmail: email, startsAt, endsAt, title, description, attendeeEmails })
    )
  );

  const calendarEventIds = calendarResults
    .filter((r) => r.status === "fulfilled" && r.value)
    .map((r) => r.value);

  return Response.json({ bookingId: booking.id, calendarEventIds });
}
