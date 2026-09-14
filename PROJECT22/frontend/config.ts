export const API_BASE_URL: string =
  ((import.meta as any).env?.VITE_API_BASE_URL as string) || 'http://localhost:8000';