import prisma from "../../../lib/prismadb";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function genToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function POST(request) {
  const { email } = await request.json();

  if (!email?.includes("@")) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const existing = await prisma.invite.findUnique({ where: { email } });
  const token = existing ? existing.token : genToken();

  if (!existing) {
    await prisma.invite.create({ data: { email, token } });
  }

  const inviteUrl = `${process.env.NEXTAUTH_URL}/join?token=${token}&email=${encodeURIComponent(email)}`;

  resend.emails.send({
    from: "Kinship Studio <onboarding@resend.dev>",
    to: email,
    subject: "You're invited to join Kinship Studio",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#2d4a35;">You're invited to Kinship Studio</h2>
        <p style="color:#555;line-height:1.6;">You've been added to the Kinship producer team. Click the link below to set up your account.</p>
        <a href="${inviteUrl}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#2d4a35;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;">
          Accept Invite
        </a>
        <p style="color:#999;font-size:12px;">Or copy this link: ${inviteUrl}</p>
      </div>
    `,
  });

  return Response.json({ token, email });
}
