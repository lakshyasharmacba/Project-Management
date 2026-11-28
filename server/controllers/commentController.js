import prisma from "../configs/prisma.js";
import { getProjectAccess } from "../utils/access.js";

// Return only these user fields with a comment (not the full user record)
const commentUserSelect = { id: true, name: true, email: true, image: true };

// Who can view / write comments on a task?
//  1. The project's team lead
//  2. A member of the project
//  3. Any ADMIN of the workspace (even if not part of this project)
// A normal workspace member who is not in the project has no access.
const canAccessComments = (access) => access.isLead || access.isMember || access.isWorkspaceAdmin;

// Add comment
export const addComment = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { content, taskId } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Comment content is required" });
        }

        const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, projectId: true } });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const access = await getProjectAccess(task.projectId, userId);
        if (!access.project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canAccessComments(access)) {
            return res.status(403).json({ message: "Only project members and workspace admins can comment" });
        }

        const comment = await prisma.comment.create({
            data: { taskId, content: content.trim(), userId },
            include: { user: { select: commentUserSelect } },
        });

        res.json({ comment });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Get comments for task
export const getTaskComments = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { taskId } = req.params;

        const task = await prisma.task.findUnique({ where: { id: taskId }, select: { id: true, projectId: true } });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const access = await getProjectAccess(task.projectId, userId);
        if (!access.project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canAccessComments(access)) {
            return res.status(403).json({ message: "You are not authorized to view comments for this task" });
        }

        const comments = await prisma.comment.findMany({
            where: { taskId },
            include: { user: { select: commentUserSelect } },
            orderBy: { createdAt: "asc" },
        });

        res.json({ comments });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};