import prisma from "../configs/prisma.js";
import { getProjectAccess } from "../utils/access.js";

// Create project
export const createProject = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { workspaceId, description, name, status, start_date, end_date, team_members, team_lead, progress, priority } = req.body;

        // Check if user has admin role for workspace
        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: { members: { include: { user: true } } },
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        if (!workspace.members.some((member) => member.userId === userId && member.role === "ADMIN")) {
            return res.status(403).json({ message: "You don't have permission to create projects in this workspace" });
        }

        // A team lead (admin) is required and must belong to this workspace
        if (!name || !name.trim()) {
            return res.status(400).json({ message: "Project name is required" });
        }
        const teamLeadMember = workspace.members.find((member) => member.user.email === team_lead);
        if (!team_lead || !teamLeadMember) {
            return res.status(400).json({ message: "Please select a team lead from this workspace" });
        }
        const teamLeadId = teamLeadMember.user.id;

        const project = await prisma.project.create({
            data: {
                workspaceId,
                name: name.trim(),
                description,
                status,
                priority,
                progress: progress ?? 0,
                team_lead: teamLeadId,
                start_date: start_date ? new Date(start_date) : null,
                end_date: end_date ? new Date(end_date) : null,
            }
        });

        // Team members are the people who do the work. The lead and workspace admins only manage, so they are not added here.
        const memberIds = workspace.members
            .filter((member) => member.role === "MEMBER" && team_members?.includes(member.user.email) && member.user.id !== teamLeadId)
            .map((member) => member.user.id);

        if (memberIds.length > 0) {
            await prisma.projectMember.createMany({
                data: memberIds.map((memberId) => ({ projectId: project.id, userId: memberId })),
                skipDuplicates: true,
            });
        }

        const projectWithMembers = await prisma.project.findUnique({
            where: { id: project.id },
            include: {
                members: { include: { user: { select: { id: true, name: true, email: true, image: true } } } },
                tasks: { include: { assignee: { select: { id: true, name: true, email: true, image: true } } } },
                owner: { select: { id: true, name: true, email: true, image: true } }
            }
        });

        res.json({ project: projectWithMembers, message: "Project created successfully" });

    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Update project
export const updateProject = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { id, workspaceId, description, name, status, start_date, end_date, progress, priority } = req.body;

        const existingProject = await prisma.project.findUnique({
            where: { id },
        });

        if (!existingProject) {
            return res.status(404).json({ message: "Project not found" });
        }

        const targetWorkspaceId = workspaceId || existingProject.workspaceId;

        if (existingProject.workspaceId !== targetWorkspaceId) {
            return res.status(403).json({ message: "Project does not belong to this workspace" });
        }

        const workspace = await prisma.workspace.findUnique({
            where: { id: targetWorkspaceId },
            include: { members: true },
        });

        if (!workspace) {
            return res.status(404).json({ message: "Workspace not found" });
        }

        const isWorkspaceAdmin = workspace.members.some(
            (member) => member.userId === userId && member.role === "ADMIN"
        );
        const isProjectLead = existingProject.team_lead === userId;

        if (!isWorkspaceAdmin && !isProjectLead) {
            return res.status(403).json({ message: "You don't have permission to update this project" });
        }

        const project = await prisma.project.update({
            where: { id },
            data: {
                description,
                name,
                status,
                priority,
                progress,
                // If no date is sent, the old date stays (it does not become null)
                start_date: start_date === undefined ? undefined : start_date ? new Date(start_date) : null,
                end_date: end_date === undefined ? undefined : end_date ? new Date(end_date) : null,
            }
        });

        res.json({ project, message: "Project updated successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Add Member to Project
export const addMember = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId } = req.params;
        const { email } = req.body;

        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { members: { include: { user: true } } },
        });

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }

        if (project.team_lead !== userId) {
            return res.status(403).json({ message: "Only project lead can add members" });
        }

        // Check if user is already a project member
        const existingMember = project.members.find((member) => member.user?.email === email);
        if (existingMember) {
            return res.status(400).json({ message: "User is already a member of this project" });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // The lead manages the project and cannot be a team member
        if (user.id === project.team_lead) {
            return res.status(400).json({ message: "Team lead manages the project and cannot be added as a team member" });
        }

        // Verify user belongs to the same workspace before adding to project
        const workspaceMember = await prisma.workspaceMember.findFirst({
            where: {
                workspaceId: project.workspaceId,
                userId: user.id,
            },
        });

        if (!workspaceMember) {
            return res.status(400).json({ message: "User must be a member of the workspace before joining this project" });
        }

        // Workspace admins only manage projects, they cannot be team members
        if (workspaceMember.role === "ADMIN") {
            return res.status(400).json({ message: "Admins manage projects and cannot be added as team members" });
        }

        const member = await prisma.projectMember.create({
            data: {
                userId: user.id,
                projectId,
            },
            include: {
                user: { select: { id: true, name: true, email: true, image: true } }
            }
        });

        res.json({ member, message: "Member added successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};

// Delete project (project lead / workspace admin only)
// Tasks, comments and members are deleted automatically (cascade in the schema)
export const deleteProject = async (req, res) => {
    try {
        const { userId } = await req.auth();
        const { projectId } = req.params;

        const { project, canManage } = await getProjectAccess(projectId, userId);

        if (!project) {
            return res.status(404).json({ message: "Project not found" });
        }
        if (!canManage) {
            return res.status(403).json({ message: "Only project lead or workspace admin can delete this project" });
        }

        await prisma.project.delete({ where: { id: projectId } });

        res.json({ message: "Project deleted successfully" });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error.code || error.message });
    }
};
