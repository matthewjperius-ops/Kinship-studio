import prisma from "../../../../lib/prismadb";

export async function GET(request, { params }) {
  const { token } = params;
  const link = await prisma.bookingLink.findUnique({ where: { token } });

  if (!link) return Response.json({ valid: false, reason: "not_found" });
  if (link.usedAt) return Response.json({ valid: false, reason: "used" });
  if (new Date() > link.expiresAt) return Response.json({ valid: false, reason: "expired" });

  return Response.json({ valid: true, producerEmail: link.producerEmail, expiresAt: link.expiresAt });
}
