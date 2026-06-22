import { Routes, Route } from 'react-router-dom'
import KaribuApp from './KaribuApp.jsx'

// For now, KaribuApp handles all internal navigation via its own state-based
// router. This lets us push to GitHub without refactoring the 2,900-line
// prototype. Once in Lovable (or any iterative environment), you can ask the
// agent to split KaribuApp into proper route-based pages in src/pages/.
export default function App() {
  return (
    <Routes>
      <Route path="/*" element={<KaribuApp />} />
    </Routes>
  )
}
