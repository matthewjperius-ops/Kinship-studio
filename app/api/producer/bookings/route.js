import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "../../../../lib/prismadb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bookings = await prisma.booking.findMany({
    where: {
      attendees: { some: { email: session.user.email } },
      clientEmail: { not: session.user.email },
    },
    orderBy: { startsAt: "asc" },
  });

  return Response.json(bookings);
}
