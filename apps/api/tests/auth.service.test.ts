import {
  getUserById,
  loginUser,
  registerUser,
  verifyToken,
} from '../src/services/auth.service';
import { db } from '../src/db/client';

describe('auth service', () => {
  beforeEach(() => {
    db.reset();
  });

  describe('getUserById', () => {
    it('returns a user without exposing the password hash', () => {
      db.insert('users', {
        email: 'erin@example.com',
        name: 'Erin',
        passwordHash: 'stored-hash',
        role: 'member',
      });

      const user = getUserById(1);

      expect(user).toMatchObject({
        id: 1,
        email: 'erin@example.com',
        name: 'Erin',
        role: 'member',
      });
      expect(user).not.toHaveProperty('passwordHash');
    });

    it('returns undefined when the user ID is not found', () => {
      expect(getUserById(999)).toBeUndefined();
    });

    it('returns undefined for a zero ID', () => {
      expect(getUserById(0)).toBeUndefined();
    });
  });

  describe('loginUser', () => {
    it('logs in with valid credentials', async () => {
      await registerUser({
        email: 'bob@example.com',
        name: 'Bob',
        password: 'hunter22!',
      });

      const { user, token } = await loginUser('bob@example.com', 'hunter22!');

      expect(user.email).toBe('bob@example.com');
      expect(user).not.toHaveProperty('passwordHash');
      expect(verifyToken(token)).toEqual({ userId: user.id, role: 'member' });
    });

    it('rejects a wrong password', async () => {
      await registerUser({
        email: 'carol@example.com',
        name: 'Carol',
        password: 'hunter22!',
      });

      await expect(
        loginUser('carol@example.com', 'wrong-password'),
      ).rejects.toThrow('invalid credentials');
    });

    it('rejects an unknown email', async () => {
      await expect(
        loginUser('nobody@example.com', 'hunter22!'),
      ).rejects.toThrow('invalid credentials');
    });

    it('rejects an empty password for a known user', async () => {
      await registerUser({
        email: 'dana@example.com',
        name: 'Dana',
        password: 'hunter22!',
      });

      await expect(loginUser('dana@example.com', '')).rejects.toThrow(
        'invalid credentials',
      );
    });
  });

  describe('registerUser', () => {
    it('registers a user without exposing the password hash', async () => {
      const { user, token } = await registerUser({
        email: 'alice@example.com',
        name: 'Alice',
        password: 'hunter22!',
      });

      expect(user).toMatchObject({
        id: 1,
        email: 'alice@example.com',
        name: 'Alice',
        role: 'member',
      });
      expect(user).not.toHaveProperty('passwordHash');
      expect(token).toBeTruthy();
    });

    it('rejects an invalid email', async () => {
      await expect(
        registerUser({
          email: 'invalid-email',
          name: 'Alice',
          password: 'hunter22!',
        }),
      ).rejects.toThrow('invalid email');
    });

    it('rejects a password that is too short', async () => {
      await expect(
        registerUser({
          email: 'alice@example.com',
          name: 'Alice',
          password: 'short',
        }),
      ).rejects.toThrow('password too short');
    });

    it('rejects a duplicate email', async () => {
      const input = {
        email: 'alice@example.com',
        name: 'Alice',
        password: 'hunter22!',
      };
      await registerUser(input);

      await expect(
        registerUser({ ...input, name: 'Another Alice' }),
      ).rejects.toThrow('email already registered');
    });
  });

  describe('verifyToken', () => {
    it('returns the user ID and role for a valid token', async () => {
      const { user, token } = await registerUser({
        email: 'frank@example.com',
        name: 'Frank',
        password: 'hunter22!',
      });

      expect(verifyToken(token)).toEqual({
        userId: user.id,
        role: 'member',
      });
    });

    it('rejects an invalid token', () => {
      expect(() => verifyToken('not-a-real-token')).toThrow();
    });

    it('rejects an empty token', () => {
      expect(() => verifyToken('')).toThrow();
    });
  });
});
