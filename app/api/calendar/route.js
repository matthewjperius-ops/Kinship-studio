import { google } from "googleapis";
import prisma from "../../../lib/prismadb";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const timeMin = searchParams.get("timeMin");
  const timeMax = searchParams.get("timeMax");
  const email   = searchParams.get("email");

  if (!timeMin || !timeMax || !email) {
    return Response.json({ error: "Missing parameters" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { accounts: { where: { provider: "google" } } },
  });

  if (!user || !user.accounts[0]) {
    return Response.json({ error: "No Google account found for this user" }, { status: 404 });
  }

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

  // Persist refreshed tokens back to the DB
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

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      },
    });

    const busy = res.data.calendars?.primary?.busy ?? [];
    return Response.json(busy.map((b) => ({ start: b.start, end: b.end })));
  } catch (err) {
    console.error(`Calendar freebusy error for ${email}:`, err?.message);
    return Response.json({ error: "Calendar fetch failed" }, { status: 500 });
  }
}
