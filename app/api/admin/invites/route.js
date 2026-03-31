import prisma from "../../../../lib/prismadb";

export async function GET() {
  const invites = await prisma.invite.findMany({ orderBy: { createdAt: "desc" } });
  return Response.json(invites);
}
