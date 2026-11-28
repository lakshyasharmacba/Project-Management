import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter, useNavigate } from 'react-router-dom'
import { store } from './app/store.js'
import { Provider } from 'react-redux'
import { ClerkProvider } from '@clerk/react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
    throw new Error('Missing Publishable Key (VITE_CLERK_PUBLISHABLE_KEY)')
}

// ClerkProvider must live INSIDE BrowserRouter so Clerk can navigate
// with react-router (no full page reloads between /sign-in and /sign-up).
const ClerkWithRouter = ({ children }) => {
    const navigate = useNavigate()
    return (
        <ClerkProvider
            publishableKey={PUBLISHABLE_KEY}
            routerPush={(to) => navigate(to)}
            routerReplace={(to) => navigate(to, { replace: true })}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
            afterSignOutUrl="/sign-in"
        >
            {children}
        </ClerkProvider>
    )
}

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <ClerkWithRouter>
            <Provider store={store}>
                <App />
            </Provider>
        </ClerkWithRouter>
    </BrowserRouter>,
)
