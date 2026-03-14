import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { MetadataProvider } from './context/MetadataContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { SystemProvider } from './context/SystemContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <BrowserRouter>
            <SystemProvider>
                <AuthProvider>
                    <MetadataProvider>
                        <App />
                    </MetadataProvider>
                </AuthProvider>
            </SystemProvider>
        </BrowserRouter>
    </React.StrictMode>,
)

