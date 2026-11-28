import prisma from "../configs/prisma.js";
import { inngest } from "../inngest/index.js";
import { getProjectAccess } from "../utils/access.js";

const assigneeSelect = { id: true, name: true, email: true, image: true };

// The task must stay saved even if sending the email event fails
const safeSend = async (event) => {
    try {
        await inngest.send(event);
    } catch (error) {
        console.log("Inngest send failed:", error.message);
    }
};

// Create task (project lead / workspace admin only)
export const createTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId, title, description, type, status, priority, assigneeId, due_date } = req.body;
        const origin = req.get("origin");

        const { project, canManage } = await getProjectAccess(projectId, userId);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canManage) {
            return res.status(403).json({ message: "Only project lead or workspace admin can create tasks" });
        }
        if (!title || !title.trim()) {
            return res.status(400).json({ message: "Task title is required" });
        }

        // Unassigned is allowed (assigneeId null). If assigned, the user must be a project member.
        const finalAssigneeId = assigneeId || null;
        if (finalAssigneeId && !project.members.some((m) => m.userId === finalAssigneeId)) {
            return res.status(400).json({ message: "Assignee is not a member of this project" });
        }

        // No due date given -> 7 days from now
        const parsedDueDate = due_date ? new Date(due_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        const finalStatus = status || "TODO";

        const task = await prisma.task.create({
            data: {
                projectId,
                title: title.trim(),
                description: description || "",
                type: type || "TASK",
                priority: priority || "MEDIUM",
                status: finalStatus,
                assigneeId: finalAssigneeId,
                due_date: parsedDueDate,
                completedAt: finalStatus === "DONE" ? new Date() : null,
            },
            include: { assignee: { select: assigneeSelect } },
        });

        if (finalAssigneeId) {
            await safeSend({ name: "app/task.assigned", data: { taskId: task.id, origin } });
        }

        res.json({ task, message: "Task created successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Update task
//  - Lead / workspace admin: can edit everything
//  - Assigned member: can change only the STATUS of their own task (to mark it Done)
export const updateTask = async (req, res) => {
    try {
        const { userId } = await req.auth();

        const task = await prisma.task.findUnique({ where: { id: req.params.id } });
        if (!task) {
            return res.status(404).json({ message: "Task not found" });
        }

        const { project, canManage } = await getProjectAccess(task.projectId, userId);
        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        const isAssignee = task.assigneeId === userId;
        if (!canManage && !isAssignee) {
            return res.status(403).json({ message: "You can only update tasks assigned to you" });
        }

        const { title, description, status, type, priority, assigneeId, due_date } = req.body;

        // A member is allowed to change only the status
        const triesOtherFields = [title, description, type, priority, assigneeId, due_date].some((v) => v !== undefined);
        if (!canManage && triesOtherFields) {
            return res.status(403).json({ message: "Members can only change the task status" });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (type !== undefined) updateData.type = type;
        if (priority !== undefined) updateData.priority = priority;
        if (due_date) updateData.due_date = new Date(due_date);

        if (status !== undefined) {
            updateData.status = status;
            // Save the time when it becomes Done, clear it if it goes back from Done
            updateData.completedAt = status === "DONE" ? new Date() : null;
        }

        if (assigneeId !== undefined) {
            if (assigneeId && !project.members.some((m) => m.userId === assigneeId)) {
                return res.status(400).json({ message: "Assignee is not a member of this project" });
            }
            updateData.assigneeId = assigneeId || null;
        }

        const updatedTask = await prisma.task.update({
            where: { id: task.id },
            data: updateData,
            include: { assignee: { select: assigneeSelect } },
        });

        // New assignee -> send an email
        if (updateData.assigneeId && updateData.assigneeId !== task.assigneeId) {
            await safeSend({ name: "app/task.assigned", data: { taskId: task.id, origin: req.get("origin") } });
        }

        if (updateData.status === "DONE" && task.status !== "DONE") {
            // A task became DONE -> email the project lead
            if (project.team_lead !== userId) {
                await safeSend({
                    name: "app/task.completed",
                    data: { taskId: task.id, completedById: userId, origin: req.get("origin") },
                });
            }

            // Every task of the project is DONE -> email the lead and all workspace admins
            const openTasks = await prisma.task.count({
                where: { projectId: task.projectId, status: { not: "DONE" } },
            });
            if (openTasks === 0) {
                await safeSend({
                    name: "app/project.completed",
                    data: { projectId: task.projectId, origin: req.get("origin") },
                });
            }
        }

        res.json({ message: "Task updated successfully", task: updatedTask });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Delete task (lead / workspace admin only)
export const deleteTask = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { tasksIds } = req.body;

        if (!Array.isArray(tasksIds) || tasksIds.length === 0) {
            return res.status(400).json({ message: "Task IDs are required" });
        }

        const tasks = await prisma.task.findMany({
            where: { id: { in: tasksIds } },
            select: { id: true, projectId: true },
        });

        if (tasks.length !== tasksIds.length) {
            return res.status(404).json({ message: "One or more tasks not found" });
        }

        // Check permission once for each project
        const projectIds = [...new Set(tasks.map((t) => t.projectId))];
        const checks = await Promise.all(projectIds.map((id) => getProjectAccess(id, userId)));

        if (!checks.every((c) => c.canManage)) {
            return res.status(403).json({ message: "You don't have permission to delete one or more selected tasks" });
        }

        await prisma.task.deleteMany({ where: { id: { in: tasksIds } } });

        res.json({ message: "Task deleted successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};
