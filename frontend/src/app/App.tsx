import { ConfigProvider } from 'antd'
import { RouterProvider } from 'react-router-dom'

import { router } from './routes'
import { appTheme } from './theme'

export function App() {
  return (
    <ConfigProvider theme={appTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

