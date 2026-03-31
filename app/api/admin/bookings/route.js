import prisma from "../../../../lib/prismadb";

export async function GET() {
  const bookings = await prisma.booking.findMany({
    orderBy: { startsAt: "desc" },
    include: { attendees: true },
  });
  return Response.json(bookings);
}
