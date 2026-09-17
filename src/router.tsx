import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Upload } from './pages/Upload'
import { Review } from './pages/Review'
import { Belege } from './pages/Belege'
import { Export } from './pages/Export'
import { Einstellungen } from './pages/Einstellungen'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'upload', element: <Upload /> },
      { path: 'belege', element: <Belege /> },
      { path: 'belege/:id/pruefen', element: <Review /> },
      { path: 'pruefen', element: <Review /> },
      { path: 'export', element: <Export /> },
      { path: 'einstellungen', element: <Einstellungen /> },
    ],
  },
])
