import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import api from "../configs/api";

// Fetch workspaces from the server. On error the old data is kept (never emptied).
export const fetchWorkspaces = createAsyncThunk("workspace/fetchWorkspaces", async ({ getToken }) => {
    const { data } = await api.get("/api/workspaces", { headers: { Authorization: `Bearer ${await getToken()}` } });
    return data.workspaces || [];
});

const initialState = {
    workspaces: [],
    currentWorkspace: null,
    currentWorkspaceId: localStorage.getItem("currentWorkspaceId"),
    loading: false, // only for the first load
    loaded: false,  // data has arrived from the server at least once
    error: null,
};

// Rule: change only `workspaces` first, then derive currentWorkspace from it.
// This keeps both always in sync.
const syncCurrent = (state) => {
    state.currentWorkspace =
        state.workspaces.find((w) => w.id === state.currentWorkspaceId) || state.workspaces[0] || null;
    state.currentWorkspaceId = state.currentWorkspace?.id || null;
};

const findProject = (state, projectId) =>
    state.workspaces.find((w) => w.id === state.currentWorkspaceId)?.projects.find((p) => p.id === projectId);

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        setCurrentWorkspace: (state, action) => {
            state.currentWorkspaceId = action.payload;
            localStorage.setItem("currentWorkspaceId", action.payload);
            syncCurrent(state);
        },
        addProject: (state, action) => {
            const workspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
            workspace?.projects.unshift(action.payload);
            syncCurrent(state);
        },
        removeProject: (state, action) => {
            // action.payload = id of the deleted project
            const workspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
            if (workspace) workspace.projects = workspace.projects.filter((p) => p.id !== action.payload);
            syncCurrent(state);
        },
        addTask: (state, action) => {
            findProject(state, action.payload.projectId)?.tasks.unshift(action.payload);
            syncCurrent(state);
        },
        updateTask: (state, action) => {
            const project = findProject(state, action.payload.projectId);
            if (project) {
                project.tasks = project.tasks.map((t) => (t.id === action.payload.id ? action.payload : t));
            }
            syncCurrent(state);
        },
        deleteTask: (state, action) => {
            // action.payload = list of task ids to delete
            const workspace = state.workspaces.find((w) => w.id === state.currentWorkspaceId);
            workspace?.projects.forEach((p) => {
                p.tasks = p.tasks.filter((t) => !action.payload.includes(t.id));
            });
            syncCurrent(state);
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchWorkspaces.pending, (state) => {
            // Do not show the loader on background refresh (this caused the flicker)
            if (!state.loaded) state.loading = true;
        });
        builder.addCase(fetchWorkspaces.fulfilled, (state, action) => {
            state.workspaces = action.payload;
            state.loading = false;
            state.loaded = true;
            state.error = null;
            syncCurrent(state);
        });
        builder.addCase(fetchWorkspaces.rejected, (state, action) => {
            state.loading = false;
            state.loaded = true;
            state.error = action.error.message;
        });
    },
});

export const { setCurrentWorkspace, addProject, removeProject, addTask, updateTask, deleteTask } = workspaceSlice.actions;
export default workspaceSlice.reducer;
