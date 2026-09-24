import { apiRequest } from './client'
import type { CommandResponse } from './types'

type ActionValue = string | number | boolean | null

function authorization(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

function hostCommand(
  roomCode: string,
  hostToken: string,
  path: string,
  body?: object,
): Promise<CommandResponse> {
  return apiRequest(
    `/api/rooms/${encodeURIComponent(roomCode)}/game/${path}`,
    {
      method: 'POST',
      headers: {
        ...authorization(hostToken),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    },
  )
}

export function configureGame(
  roomCode: string,
  hostToken: string,
  mode: string,
): Promise<CommandResponse> {
  return hostCommand(roomCode, hostToken, 'configure', { mode })
}

export function startGame(
  roomCode: string,
  hostToken: string,
): Promise<CommandResponse> {
  return hostCommand(roomCode, hostToken, 'start')
}

export function activateRound(
  roomCode: string,
  hostToken: string,
): Promise<CommandResponse> {
  return hostCommand(roomCode, hostToken, 'round/activate')
}

export function revealRound(
  roomCode: string,
  hostToken: string,
): Promise<CommandResponse> {
  return hostCommand(roomCode, hostToken, 'round/reveal')
}

export function showScoreboard(
  roomCode: string,
  hostToken: string,
): Promise<CommandResponse> {
  return hostCommand(roomCode, hostToken, 'round/scoreboard')
}

export function finishRound(
  roomCode: string,
  hostToken: string,
): Promise<CommandResponse> {
  return hostCommand(roomCode, hostToken, 'round/finish')
}

export function submitPlayerAction(
  roomCode: string,
  playerToken: string,
  actionType: string,
  value: ActionValue,
): Promise<CommandResponse> {
  return apiRequest(
    `/api/rooms/${encodeURIComponent(roomCode)}/game/actions`,
    {
      method: 'POST',
      headers: {
        ...authorization(playerToken),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ actionType, value }),
    },
  )
}
