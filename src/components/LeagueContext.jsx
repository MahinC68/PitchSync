import { createContext, useContext } from 'react'
export const LeagueContext = createContext(null)
export function useLeagues() { return useContext(LeagueContext) }
