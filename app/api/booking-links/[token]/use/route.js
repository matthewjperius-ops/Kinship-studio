import prisma from "../../../../../lib/prismadb";

export async function POST(request, { params }) {
  const { token } = params;
  await prisma.bookingLink.update({
    where: { token },
    data: { usedAt: new Date() },
  });
  return Response.json({ ok: true });
}
