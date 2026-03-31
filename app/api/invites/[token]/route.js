import prisma from "../../../../lib/prismadb";

export async function GET(request, { params }) {
  const { token } = params;
  const invite = await prisma.invite.findUnique({ where: { token } });
  return Response.json({ valid: !!invite, email: invite?.email ?? null });
}
