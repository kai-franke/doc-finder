import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import MainArea from './MainArea'

export default function AppShell() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainArea />
      </div>
    </div>
  )
}
