import { Routes, Route } from 'react-router-dom'
import KaribuApp from './KaribuApp.jsx'
import { ReferenceDataProvider } from './context/ReferenceDataContext.jsx'

// For now, KaribuApp handles all internal navigation via its own state-based
// router. This lets us push to GitHub without refactoring the 2,900-line
// prototype. Once in Lovable (or any iterative environment), you can ask the
// agent to split KaribuApp into proper route-based pages in src/pages/.
//
// ReferenceDataProvider wraps every screen so cities/categories (KAR-5) come
// from one app-load Supabase fetch held in Context, with the prototype
// constants as the initial/fallback value (identical first paint).
export default function App() {
  return (
    <ReferenceDataProvider>
      <Routes>
        <Route path="/*" element={<KaribuApp />} />
      </Routes>
    </ReferenceDataProvider>
  )
}
