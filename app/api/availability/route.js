import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "../../../lib/prismadb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json(null);

  const avail = await prisma.availability.findFirst({ where: { userId: user.id } });
  if (!avail?.rule) return Response.json(null);

  try {
    return Response.json(JSON.parse(avail.rule));
  } catch {
    return Response.json(null);
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await request.json();

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  const now = new Date();
  await prisma.availability.upsert({
    where: { id: (await prisma.availability.findFirst({ where: { userId: user.id } }))?.id ?? "" },
    update: { rule: JSON.stringify(config) },
    create: {
      userId: user.id,
      startTime: now,
      endTime: now,
      rule: JSON.stringify(config),
    },
  });

  return Response.json({ ok: true });
}
