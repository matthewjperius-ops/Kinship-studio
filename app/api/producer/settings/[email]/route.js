import prisma from "../../../../../lib/prismadb";

export async function GET(request, { params }) {
  const email = decodeURIComponent(params.email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return Response.json(null);

  const avail = await prisma.availability.findFirst({ where: { userId: user.id } });
  if (!avail?.rule) return Response.json(null);

  try {
    return Response.json(JSON.parse(avail.rule));
  } catch {
    return Response.json(null);
  }
}
