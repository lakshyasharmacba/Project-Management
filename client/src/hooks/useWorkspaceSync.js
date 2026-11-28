import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useOrganizationList, useUser } from "@clerk/react";
import { useDispatch, useSelector, useStore } from "react-redux";
import toast from "react-hot-toast";
import api from "../configs/api";
import { fetchWorkspaces } from "../features/workspaceSlice";

const POLL_MS = 20000; // silently refresh data every 20 seconds

// Is the project non-empty and fully completed?
const isAllDone = (project) => project.tasks.length > 0 && project.tasks.every((t) => t.status === "DONE");

// Is this user an admin of the workspace, or the lead of the project?
const canManageProject = (workspace, project, userId) =>
    project.team_lead === userId ||
    workspace.members?.some((m) => m.user?.id === userId && m.role === "ADMIN");

// Used once in Layout. It does 4 things:
// 1. Loads the workspaces the first time
// 2. Matches Clerk organizations with DB workspaces (a new org shows up immediately)
// 3. Refreshes in the background and tells admins when a member completes a task
// 4. Tells admins once when every task of a project is done
export default function useWorkspaceSync() {
    const { user, isLoaded } = useUser();
    const { getToken } = useAuth();
    const dispatch = useDispatch();
    const store = useStore();
    const { workspaces, loaded, loading, currentWorkspace, error } = useSelector((state) => state.workspace);
    const [syncError, setSyncError] = useState(null);
    const lastSyncKey = useRef(null);
    const { userMemberships, isLoaded: orgsLoaded } = useOrganizationList({ userMemberships: true });

    const clerkCount = userMemberships?.count ?? userMemberships?.data?.length ?? 0;

    // 1. First load
    useEffect(() => {
        if (isLoaded && user && !loaded && !loading) dispatch(fetchWorkspaces({ getToken }));
    }, [isLoaded, user, loaded, loading, dispatch, getToken]);

    // Clerk -> DB sync, then fetch again
    const syncNow = useCallback(async () => {
        setSyncError(null);
        try {
            await api.post("/api/workspaces/sync", {}, { headers: { Authorization: `Bearer ${await getToken()}` } });
        } catch (err) {
            const message = err?.response?.data?.message || err.message;
            console.log("Workspace sync failed:", message);
            setSyncError(message);
        }
        dispatch(fetchWorkspaces({ getToken }));
    }, [dispatch, getToken]);

    // 2. Counts do not match (new org / late webhook) -> sync once.
    // lastSyncKey stops repeated syncs for the same mismatch (avoids an infinite loop).
    useEffect(() => {
        if (!loaded || !orgsLoaded || clerkCount === workspaces.length) return;
        const key = `${clerkCount}:${workspaces.length}`;
        if (lastSyncKey.current === key) return;
        lastSyncKey.current = key;
        syncNow();
    }, [loaded, orgsLoaded, clerkCount, workspaces.length, syncNow]);

    // If loading failed (server asleep, network problem), try again every 5 seconds until it works
    useEffect(() => {
        if (!user || !loaded || !error || workspaces.length > 0) return;
        const timer = setInterval(() => dispatch(fetchWorkspaces({ getToken })), 5000);
        return () => clearInterval(timer);
    }, [user, loaded, error, workspaces.length, dispatch, getToken]);

    // 3. Background refresh + "task completed" alert for admins
    useEffect(() => {
        if (!user) return;

        const refresh = async () => {
            if (document.visibilityState !== "visible") return;

            const before = store.getState().workspace.currentWorkspace;
            const result = await dispatch(fetchWorkspaces({ getToken }));
            if (!fetchWorkspaces.fulfilled.match(result) || !before) return;

            const now = store.getState().workspace.currentWorkspace;
            if (!now || now.id !== before.id) return;

            const oldStatus = new Map(before.projects.flatMap((p) => p.tasks.map((t) => [t.id, t.status])));

            now.projects
                .filter((p) => canManageProject(now, p, user.id))
                .flatMap((p) => p.tasks)
                .forEach((t) => {
                    const wasOpen = oldStatus.has(t.id) && oldStatus.get(t.id) !== "DONE";
                    if (wasOpen && t.status === "DONE" && t.assigneeId !== user.id) {
                        toast.success(`${t.assignee?.name || "A member"} completed "${t.title}"`, { duration: 6000 });
                    }
                });
        };

        const timer = setInterval(refresh, POLL_MS);
        document.addEventListener("visibilitychange", refresh);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", refresh);
        };
    }, [user, dispatch, getToken, store]);

    // 4. All tasks of a project are done -> tell every admin ONE time.
    // The "seen" mark is kept in localStorage, so a second admin who opens the app later also sees it once.
    useEffect(() => {
        if (!user || !currentWorkspace) return;

        currentWorkspace.projects.forEach((project) => {
            if (!canManageProject(currentWorkspace, project, user.id)) return;

            const key = `allDoneSeen:${user.id}:${project.id}`;
            try {
                if (!isAllDone(project)) {
                    localStorage.removeItem(key); // work was reopened, allow the message again later
                    return;
                }
                const signature = String(project.tasks.length);
                if (localStorage.getItem(key) === signature) return;

                localStorage.setItem(key, signature);
                toast.success(`All members have completed their work in "${project.name}"`, { duration: 8000 });
            } catch {
                // localStorage not available: skip the message
            }
        });
    }, [currentWorkspace, user]);

    return { clerkCount, syncNow, syncError };
}
