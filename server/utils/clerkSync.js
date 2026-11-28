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

    try {
        return await prisma.user.upsert({
            where: { id: userId },
            update: data,
            create: { id: userId, ...data },
        });
    } catch (error) {
        // email is unique: the same email already exists in the DB under another Clerk user id
        if (error.code === "P2002") {
            throw new Error(`The email ${email} already exists in the database under a different user id. Delete that old user row (or sign in with the old account).`);
        }
        throw error;
    }
};

// Bring all Clerk organizations (workspaces) into the DB.
// The workspace shows up immediately even if the webhook is late or fails.
// One broken organization does not stop the others from syncing.
export const syncWorkspacesFromClerk = async (userId) => {
    await syncUserFromClerk(userId);

    const { data: memberships } = await clerkClient.users.getOrganizationMembershipList({
        userId,
        limit: 100,
    });

    const errors = [];

    for (const m of memberships) {
        try {
            const org = m.organization;
            const role = m.role === "org:admin" ? "ADMIN" : "MEMBER";

            // Owner is the user who created the org (if in the DB), otherwise the current user
            const creator = org.createdBy
                ? await prisma.user.findUnique({ where: { id: org.createdBy }, select: { id: true } })
                : null;

            // slug is unique: if an old workspace (deleted in Clerk) still uses it, add a short suffix
            let slug = org.slug || org.id;
            const existing = await prisma.workspace.findUnique({ where: { id: org.id }, select: { id: true } });
            if (!existing) {
                const slugTaken = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
                if (slugTaken) slug = `${slug}-${org.id.slice(-6)}`;
            }

            await prisma.workspace.upsert({
                where: { id: org.id },
                update: { name: org.name, image_url: org.imageUrl || "" },
                create: {
                    id: org.id,
                    name: org.name,
                    slug,
                    ownerId: creator?.id || userId,
                    image_url: org.imageUrl || "",
                },
            });

            await prisma.workspaceMember.upsert({
                where: { userId_workspaceId: { userId, workspaceId: org.id } },
                update: { role },
                create: { userId, workspaceId: org.id, role },
            });
        } catch (error) {
            console.log(`Sync failed for organization ${m.organization?.id}:`, error.message);
            errors.push(error.message);
        }
    }

    // Only fail when nothing could be synced (so the client can show the reason)
    if (errors.length > 0 && errors.length === memberships.length) {
        throw new Error(errors[0]);
    }
};
