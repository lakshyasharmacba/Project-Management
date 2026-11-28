import { useNavigate } from 'react-router-dom'

const NotFound = () => {
    const navigate = useNavigate()
    return (
        <div className="p-6 text-center text-zinc-900 dark:text-zinc-200">
            <p className="text-5xl md:text-7xl mt-32 mb-4 font-semibold">404</p>
            <p className="text-lg text-zinc-500 dark:text-zinc-400">Page not found</p>
            <button
                onClick={() => navigate('/')}
                className="mt-8 px-4 py-2 rounded bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-white dark:hover:bg-zinc-600"
            >
                Go to Dashboard
            </button>
        </div>
    )
}

export default NotFound
