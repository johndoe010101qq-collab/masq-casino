import React from 'react';
import MinecraftClassicArt from './MinecraftClassicArt.jsx';
import { minecraftTerminalState } from './minecraft-classic-motion.js';
import './UpgraderHacker.css';
export default function UpgraderHacker({ round, progress, playing, targetChoice = 2, reduced = false, visible = true }) {
  const state = minecraftTerminalState(round, progress, playing, targetChoice, reduced);
  return <div className={'hacker-workstation minecraft-terminal outcome-' + state.outcome + ' terminal-phase-' + state.phase}>
    <MinecraftClassicArt game="upgrader" round={round} progress={progress} playing={playing} targetChoice={targetChoice} reduced={reduced} visible={visible} />
    <div className="minecraft-terminal-readout"><span>{state.title}</span><strong>{state.code}</strong></div>
  </div>;
}