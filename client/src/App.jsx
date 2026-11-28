import { lazy } from 'react'
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { SignIn, SignUp } from '@clerk/react'
import Layout from './pages/Layout'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const Team = lazy(() => import('./pages/Team'))
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'))
const TaskDetails = lazy(() => import('./pages/TaskDetails'))
const Settings = lazy(() => import('./pages/Settings'))
import NotFound from './pages/NotFound'

// Separate full-page wrapper for the auth forms
const AuthPage = ({ children }) => (
    <div className="flex justify-center items-center min-h-screen bg-white dark:bg-zinc-950">
        {children}
    </div>
)

// Old URLs (/projectsDetail?id=..&tab=.. and /taskDetails?projectId=..&taskId=..)
// still work: they redirect to the new clean routes.
const LegacyProjectRedirect = () => {
    const [params] = useSearchParams()
    const id = params.get('id')
    const tab = params.get('tab')
    if (!id) return <Navigate to="/projects" replace />
    return <Navigate to={`/projects/${id}${tab ? `?tab=${tab}` : ''}`} replace />
}

const LegacyTaskRedirect = () => {
    const [params] = useSearchParams()
    const projectId = params.get('projectId')
    const taskId = params.get('taskId')
    if (!projectId || !taskId) return <Navigate to="/projects" replace />
    return <Navigate to={`/projects/${projectId}/tasks/${taskId}`} replace />
}

const App = () => {
    return (
        <>
            <Toaster />
            <Routes>
                {/* Public auth routes: separate pages, separate forms */}
                <Route
                    path="/sign-in/*"
                    element={
                        <AuthPage>
                            <SignIn
                                routing="path"
                                path="/sign-in"
                                signUpUrl="/sign-up"
                                fallbackRedirectUrl="/"
                                appearance={{ elements: { lastAuthenticationStrategyBadge: { display: 'none' } } }}
                            />
                        </AuthPage>
                    }
                />
                <Route
                    path="/sign-up/*"
                    element={
                        <AuthPage>
                            <SignUp
                                routing="path"
                                path="/sign-up"
                                signInUrl="/sign-in"
                                fallbackRedirectUrl="/"
                            />
                        </AuthPage>
                    }
                />

                {/* Protected app routes (Layout redirects to /sign-in if signed out) */}
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="team" element={<Team />} />
                    <Route path="projects" element={<Projects />} />
                    <Route path="projects/:projectId" element={<ProjectDetails />} />
                    <Route path="projects/:projectId/tasks/:taskId" element={<TaskDetails />} />
                    <Route path="settings" element={<Settings />} />

                    {/* legacy URLs */}
                    <Route path="projectsDetail" element={<LegacyProjectRedirect />} />
                    <Route path="taskDetails" element={<LegacyTaskRedirect />} />

                    <Route path="*" element={<NotFound />} />
                </Route>
            </Routes>
        </>
    )
}

export default App
