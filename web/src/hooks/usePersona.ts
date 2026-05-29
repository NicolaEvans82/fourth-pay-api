import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Persona, PersonaKey } from '../types/api';

export const PERSONAS: Record<PersonaKey, Persona> = {
  jordan: {
    faid: 'JORDANHARRIS000001',
    employerId: 'CROWN-PUB-GROUP',
    firstName: 'Jordan',
    fullName: 'Jordan Harris',
    role: 'Bar Supervisor',
    initials: 'JH',
  },
  marcus: {
    faid: 'MARCUSTHOMPSON000001',
    employerId: 'CROWN-PUB-GROUP',
    firstName: 'Marcus',
    fullName: 'Marcus Thompson',
    role: 'Hotel Receptionist',
    initials: 'MT',
  },
};

const STORAGE_KEY = 'fp_persona';

function readStoredPersona(): PersonaKey {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'marcus' ? 'marcus' : 'jordan';
  } catch {
    return 'jordan';
  }
}

interface PersonaContextValue {
  key: PersonaKey;
  persona: Persona;
  headers: Record<string, string>;
  switchPersona: (key: PersonaKey) => void;
}

const PersonaContext = createContext<PersonaContextValue | null>(null);

export function usePersonaState(): PersonaContextValue {
  const [key, setKey] = useState<PersonaKey>(() => readStoredPersona());
  const persona = PERSONAS[key];
  const headers = useMemo(
    () => ({
      'x-fourth-employee-id': persona.faid,
      'x-fourth-employer-id': persona.employerId,
    }),
    [persona.faid, persona.employerId],
  );
  const switchPersona = useCallback((next: PersonaKey) => {
    setKey(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (private mode etc.) — fall through.
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {}
  }, [key]);
  return { key, persona, headers, switchPersona };
}

export { PersonaContext };

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error('usePersona must be used inside <PersonaContext.Provider>');
  }
  return ctx;
}
