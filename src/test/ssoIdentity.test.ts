import { describe, it, expect } from 'vitest';
import {
  identityUpdateForExistingUser,
  mapCentralLevelToRole,
} from '../../supabase/functions/sso-exchange/identity';

describe('identityUpdateForExistingUser', () => {
  it('nunca inclui o papel: ajuste feito no VP Click não é desfeito pelo login', () => {
    const update = identityUpdateForExistingUser('Ana', 'http://a/x.png');
    expect(update).toEqual({ name: 'Ana', avatar: 'http://a/x.png' });
    expect('role' in update).toBe(false);
  });
  it('não sobrescreve o avatar quando o vpsistema não tem um', () => {
    expect(identityUpdateForExistingUser('Ana', null)).toEqual({ name: 'Ana' });
  });
});

describe('mapCentralLevelToRole (papel inicial na criação)', () => {
  it('mapeia admin, líder/gestor e o resto', () => {
    expect(mapCentralLevelToRole('Administrador')).toBe('ADMIN');
    expect(mapCentralLevelToRole('Líder')).toBe('GESTOR');
    expect(mapCentralLevelToRole('gestor de área')).toBe('GESTOR');
    expect(mapCentralLevelToRole('Operacional')).toBe('COLABORADOR');
    expect(mapCentralLevelToRole(undefined)).toBe('COLABORADOR');
  });
});
