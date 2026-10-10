import { useEffect, useState } from 'react'
import { GameScreen } from './components/GameScreen.tsx'
import { HomeScreen } from './components/HomeScreen.tsx'
import { RulesModal } from './components/RulesModal.tsx'
import { SettingsModal } from './components/SettingsModal.tsx'
import type { DifficultyId } from './game/difficulty.ts'
import {
  loadLastDifficulty,
  loadSettings,
  recordPlayed,
  saveLastDifficulty,
  saveSettings,
  type Settings,
} from './game/storage.ts'

function App() {
  const [settings, setSettings] = useState(loadSettings)
  const [difficulty, setDifficulty] = useState(loadLastDifficulty)
  const [screen, setScreen] = useState<'home' | 'game'>('home')
  const [overlay, setOverlay] = useState<'settings' | 'rules' | null>(null)

  useEffect(() => {
    const root = document.documentElement
    if (settings.theme === 'auto') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  function updateSettings(next: Settings) {
    setSettings(next)
    saveSettings(next)
  }

  function selectDifficulty(next: DifficultyId) {
    setDifficulty(next)
    saveLastDifficulty(next)
  }

  function start() {
    recordPlayed(difficulty)
    setScreen('game')
  }

  if (screen === 'game') {
    return (
      <GameScreen
        difficulty={difficulty}
        settings={settings}
        onSettingsChange={updateSettings}
        onHome={() => setScreen('home')}
      />
    )
  }

  return (
    <>
      <HomeScreen
        difficulty={difficulty}
        settings={settings}
        onDifficultyChange={selectDifficulty}
        onStart={start}
        onOpenSettings={() => setOverlay('settings')}
        onOpenRules={() => setOverlay('rules')}
      />
      {overlay === 'settings' && (
        <SettingsModal settings={settings} onChange={updateSettings} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'rules' && <RulesModal onClose={() => setOverlay(null)} />}
    </>
  )
}

export default App
