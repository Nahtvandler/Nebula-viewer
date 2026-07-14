import { useQuery } from '@tanstack/react-query'
import { api } from './api/client'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15000,
    retry: false,
  })
}

export function useSpaces() {
  return useQuery({
    queryKey: ['spaces'],
    queryFn: api.spaces,
    staleTime: 60000,
    retry: false,
  })
}

export function useSchema(space: string) {
  return useQuery({
    queryKey: ['schema', space],
    queryFn: () => api.schema(space || undefined),
    enabled: space.length > 0,
    staleTime: 60000,
    retry: false,
  })
}
