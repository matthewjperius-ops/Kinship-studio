import prisma from "../../../../../lib/prismadb";

export async function DELETE(request, { params }) {
  await prisma.producer.delete({ where: { id: params.id } });
  return Response.json({ ok: true });
}
