import prisma from "../../../lib/prismadb";

function genToken() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export async function POST(request) {
  const { email } = await request.json();

  if (!email?.includes("@")) {
    return Response.json({ error: "Invalid email" }, { status: 400 });
  }

  const existing = await prisma.invite.findUnique({ where: { email } });
  if (existing) {
    return Response.json({ token: existing.token, email });
  }

  const token = genToken();
  await prisma.invite.create({ data: { email, token } });

  return Response.json({ token, email });
}
