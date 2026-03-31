import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import prisma from "../../../lib/prismadb";

function genToken() {
  return Math.random().toString(36).slice(2, 12).toUpperCase();
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = genToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await prisma.bookingLink.create({
    data: { token, producerEmail: session.user.email, expiresAt },
  });

  return Response.json({ token, expiresAt });
}
