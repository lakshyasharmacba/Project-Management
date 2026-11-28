import { useUser } from "@clerk/react";
import { useSelector } from "react-redux";

// What can the current user do in this project?
//  isLead    -> the project's team lead (admin)
//  canManage -> lead or workspace admin (create / edit / delete tasks)
export default function useProjectAccess(project) {
    const { user } = useUser();
    const currentWorkspace = useSelector((state) => state.workspace.currentWorkspace);

    const myRole = currentWorkspace?.members?.find((m) => m.user?.id === user?.id)?.role;
    const isLead = Boolean(project) && project.team_lead === user?.id;
    const isWorkspaceAdmin = myRole === "ADMIN";

    return { userId: user?.id, isLead, isWorkspaceAdmin, canManage: isLead || isWorkspaceAdmin };
}

// Real team members only: the lead and every workspace admin are left out.
// Pass currentWorkspace.members as the second argument.
export const getWorkers = (project, workspaceMembers = []) => {
    const adminIds = new Set(workspaceMembers.filter((m) => m.role === "ADMIN").map((m) => m.user?.id));

    return (project?.members || []).filter(
        (m) => m?.user?.id && m.user.id !== project.team_lead && !adminIds.has(m.user.id)
    );
};
