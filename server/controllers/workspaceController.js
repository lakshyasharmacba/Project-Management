import prisma from "../configs/prisma.js";
import { syncWorkspacesFromClerk } from "../utils/clerkSync.js";

const userSelect = { id: true, name: true, email: true, image: true };

// Get all workspaces for user
// Comments are not loaded here (TaskDetails loads them from /api/comments/:taskId)
export const getUserWorkspaces = async (req, res) => {
    try {
        const { userId } = await req.auth();

        const workspaces = await prisma.workspace.findMany({
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
