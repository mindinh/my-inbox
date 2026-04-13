import { createRoot } from 'react-dom/client'

import './i18n'; // Initialize i18n before rendering
import './styles/index.css'
import App from './App.tsx'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './queryClient'
import { FioriThemeProvider } from './contexts/FioriThemeContext.tsx'
import { initFLPMessageListener } from './hooks/useFLPSync'
import { SessionTimeoutProvider } from './components/providers/SessionTimeoutProvider.tsx'

// Initialize FLP message listener for iframe communication
initFLPMessageListener();

createRoot(document.getElementById('root')!).render(
    <QueryClientProvider client={queryClient}>
        <FioriThemeProvider>
            <SessionTimeoutProvider>
                <App />
            </SessionTimeoutProvider>
        </FioriThemeProvider>
    </QueryClientProvider>
)
