import prisma from "../configs/prisma.js";
import { syncWorkspacesFromClerk } from "../utils/clerkSync.js";

const userSelect = { id: true, name: true, email: true, image: true };

// Remember when we last synced a user from Clerk, so Clerk is not called on every request
const lastAutoSync = new Map();
const AUTO_SYNC_GAP_MS = 15000;

const findWorkspaces = (userId) =>
    prisma.workspace.findMany({
        where: { members: { some: { userId } } },
        include: {
            members: { include: { user: { select: userSelect } } },
            projects: {
                include: {
                    tasks: {
                        include: { assignee: { select: userSelect } },
                        orderBy: { createdAt: "desc" },
                    },
                    members: { include: { user: { select: userSelect } } },
                },
                orderBy: { createdAt: "desc" },
            },
            owner: { select: userSelect },
        },
    });

// Get all workspaces for user
// Comments are not loaded here (TaskDetails loads them from /api/comments/:taskId)
export const getUserWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();

        let workspaces = await findWorkspaces(userId);

        // No workspace in the DB: the Clerk webhook may be late or may have failed.
        // Sync from Clerk right here, then look again, so the user never gets stuck on a loading screen.
        if (workspaces.length === 0 && Date.now() - (lastAutoSync.get(userId) || 0) > AUTO_SYNC_GAP_MS) {
            lastAutoSync.set(userId, Date.now());
            try {
                await syncWorkspacesFromClerk(userId);
                workspaces = await findWorkspaces(userId);
            } catch (error) {
                console.log("Auto sync failed:", error.message);
            }
        }

        res.json({ workspaces });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Match Clerk organizations with the DB (the client calls this when the counts differ)
export const syncWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();
        await syncWorkspacesFromClerk(userId);
        res.json({ message: "Workspaces synced" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
};
