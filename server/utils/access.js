import prisma from "../configs/prisma.js";

// One place to check: is the user the project lead? a workspace admin? a member?
// All controllers use this function (no repeated code).
export const getProjectAccess = async (projectId, userId) => {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: {
            members: { select: { userId: true } },
            workspace: { select: { members: { where: { userId }, select: { role: true } } } },
        },
    });

    if (!project) return { project: null };

    const isLead = project.team_lead === userId;
    const isWorkspaceAdmin = project.workspace.members.some((m) => m.role === "ADMIN");
    const isMember = project.members.some((m) => m.userId === userId);

    return {
        project,
        isLead,
        isWorkspaceAdmin,
        isMember,
        // Lead or workspace admin can manage (create, edit, delete tasks)
        canManage: isLead || isWorkspaceAdmin,
    };
};
