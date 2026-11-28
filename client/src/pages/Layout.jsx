import { useState, useEffect, Suspense } from 'react'
import Navbar from '../components/Navbar'
import Sidebar from '../components/Sidebar'
import { Outlet, Navigate } from 'react-router-dom'
import { CreateOrganization, useUser } from '@clerk/react'
import { useDispatch, useSelector } from 'react-redux'
import { loadTheme } from '../features/themeSlice'
import { Loader2Icon } from 'lucide-react'
import useWorkspaceSync from '../hooks/useWorkspaceSync'

const FullScreenLoader = ({ message, onRetry }) => (
    <div className='flex flex-col gap-3 items-center justify-center h-screen bg-white dark:bg-zinc-950 text-gray-600 dark:text-zinc-400'>
        <Loader2Icon className="size-7 text-blue-500 animate-spin" />
        {message && <p className='text-sm'>{message}</p>}
        {onRetry && (
            <button onClick={onRetry} className='text-sm px-4 py-1.5 rounded border border-gray-300 dark:border-zinc-700'>
                Retry
            </button>
        )}
    </div>
)

const Layout = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const { user, isLoaded } = useUser()
    const { workspaces, loaded, error: fetchError } = useSelector((state) => state.workspace)
    const dispatch = useDispatch()
    const { clerkCount, syncNow, syncError } = useWorkspaceSync()

    useEffect(() => {
        dispatch(loadTheme())
    }, [dispatch])

    // Wait until Clerk has loaded (avoids a sign-in form flash)
    if (!isLoaded) return <FullScreenLoader message="Loading your workspace..." />

    // Logged out -> go to the sign-in page
    if (!user) return <Navigate to="/sign-in" replace />

    // Wait for the first server response so the "Create Organization" form does not flash by mistake.
    if (!loaded) return <FullScreenLoader message="Loading your workspace..." />

    if (workspaces.length === 0) {
        // The org exists in Clerk but not in the DB yet -> do not create a new one, let it sync
        if (clerkCount > 0) {
            // Same loader as above (it looks like one single loading). If it fails, show the reason + Retry.
            const errorMessage = syncError || fetchError
            return (
                <FullScreenLoader
                    message={errorMessage ? `Could not load workspace: ${errorMessage}` : "Loading your workspace..."}
                    onRetry={errorMessage ? syncNow : undefined}
                />
            )
        }
        return (
            <div className="min-h-screen flex justify-center items-center">
                <CreateOrganization afterCreateOrganizationUrl="/" />
            </div>
        )
    }

    return (
        <div className="flex bg-white dark:bg-zinc-950 text-gray-900 dark:text-slate-100">
            <Sidebar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
            <div className="flex-1 flex flex-col h-screen">
                <Navbar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />
                <div className="flex-1 h-full p-6 xl:p-10 xl:px-16 overflow-y-scroll">
                    <Suspense fallback={<div className='flex justify-center pt-24'><Loader2Icon className='size-6 text-blue-500 animate-spin' /></div>}>
                        <Outlet />
                    </Suspense>
                </div>
            </div>
        </div>
    )
}

export default Layout
