import { clerkClient } from "@clerk/express";
import prisma from "../configs/prisma.js";

// Build a readable name from the Clerk user: full name -> username -> email prefix
const makeName = (u, email) =>
    [u.firstName, u.lastName].filter(Boolean).join(" ") ||
    u.username ||
    email?.split("@")[0] ||
    "User";

// Get the real user data from Clerk and save it in the DB (name + email + image)
export const syncUserFromClerk = async (userId) => {
    const u = await clerkClient.users.getUser(userId);
    const email =
        u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
        u.emailAddresses[0]?.emailAddress;

    if (!email) return null;

    const data = { email, name: makeName(u, email), image: u.imageUrl || "" };

    return prisma.user.upsert({
        where: { id: userId },
        update: data,
        create: { id: userId, ...data },
    });
};

// Bring all Clerk organizations (workspaces) into the DB.
// The workspace shows up immediately even if the webhook is late or fails.
export const syncWorkspacesFromClerk = async (userId) => {
    await syncUserFromClerk(userId);

    const { data: memberships } = await clerkClient.users.getOrganizationMembershipList({
        userId,
        limit: 100,
    });

    for (const m of memberships) {
        const org = m.organization;
        const role = m.role === "org:admin" ? "ADMIN" : "MEMBER";

        // Owner is the user who created the org (if in the DB), otherwise the current user
        const creator = org.createdBy
            ? await prisma.user.findUnique({ where: { id: org.createdBy }, select: { id: true } })
            : null;

        await prisma.workspace.upsert({
            where: { id: org.id },
            update: { name: org.name, image_url: org.imageUrl || "" },
            create: {
                id: org.id,
                name: org.name,
                slug: org.slug || org.id,
                ownerId: creator?.id || userId,
                image_url: org.imageUrl || "",
            },
        });

        await prisma.workspaceMember.upsert({
            where: { userId_workspaceId: { userId, workspaceId: org.id } },
            update: { role },
            create: { userId, workspaceId: org.id, role },
        });
    }
};
