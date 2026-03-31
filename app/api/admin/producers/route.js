import prisma from "../../../../lib/prismadb";

export async function GET() {
  const producers = await prisma.producer.findMany({ orderBy: { createdAt: "asc" } });
  return Response.json(producers);
}

export async function POST(request) {
  const { name, email, specialty, bio, color } = await request.json();
  if (!name || !email) return Response.json({ error: "Missing fields" }, { status: 400 });

  const producer = await prisma.producer.upsert({
    where: { email },
    update: { name, specialty, bio, color },
    create: { name, email, specialty: specialty || "photo", bio, color: color || "#d6e0d0" },
  });
  return Response.json(producer);
}
