import { createBrowserRouter } from 'react-router-dom'

import { AdminPage } from '../features/admin/AdminPage'
import { HomePage } from '../features/home/HomePage'
import { HostPage } from '../features/host/HostPage'
import { PlayerPage } from '../features/player/PlayerPage'
import { ScreenPage } from '../features/screen/ScreenPage'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/screen/:roomCode', element: <ScreenPage /> },
  { path: '/host/:roomCode', element: <HostPage /> },
  { path: '/player/:roomCode', element: <PlayerPage /> },
  { path: '/admin', element: <AdminPage /> },
])

