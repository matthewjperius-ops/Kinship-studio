import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import prisma from "../../../../lib/prismadb";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, image: true, specialty: true, bio: true, email: true },
  });

  return Response.json(user);
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name, specialty, bio, image } = await request.json();

  const user = await prisma.user.update({
    where: { email: session.user.email },
    data: {
      ...(name      !== undefined && { name }),
      ...(specialty !== undefined && { specialty }),
      ...(bio       !== undefined && { bio }),
      ...(image     !== undefined && { image }),
    },
    select: { name: true, image: true, specialty: true, bio: true, email: true },
  });

  return Response.json(user);
}
