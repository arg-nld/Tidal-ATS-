import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRegistrationBody } from '../middleware/inputValidation.js';
import { hashPassword, matchesExistingPassword } from '../services/passwordService.js';

function runRegistrationValidation(body) {
  let proceeded = false;
  let statusCode = 200;
  let responseBody = null;
  const req = { body: { ...body } };
  const res = {
    status(code) { statusCode = code; return this; },
    json(payload) { responseBody = payload; return this; }
  };

  validateRegistrationBody(req, res, () => { proceeded = true; });
  return { proceeded, statusCode, responseBody, body: req.body };
}

test('registration normalizes first and last names to uppercase', () => {
  const result = runRegistrationValidation({
    firstName: '  maria  clara ',
    lastName: 'de la Cruz',
    middleInitial: 'm',
    suffix: '',
    email: 'PERSON@example.com',
    password: 'StrongPassword1'
  });

  assert.equal(result.proceeded, true);
  assert.equal(result.body.firstName, 'MARIA CLARA');
  assert.equal(result.body.lastName, 'DE LA CRUZ');
  assert.equal(result.body.middleInitial, 'M');
  assert.equal(result.body.email, 'person@example.com');
});

test('registration rejects digits and symbols in first or last name', () => {
  for (const invalidName of ['Andrei2', 'Anne-Marie', "O'Neil", 'Name!']) {
    const result = runRegistrationValidation({
      firstName: invalidName,
      lastName: 'Co',
      middleInitial: '',
      suffix: '',
      email: 'person@example.com',
      password: 'StrongPassword1'
    });
    assert.equal(result.proceeded, false, `Expected ${invalidName} to be rejected`);
    assert.equal(result.statusCode, 400);
    assert.match(result.responseBody.error, /letters and spaces only/i);
  }
});

test('password reset helper detects reuse of the existing password', () => {
  const user = { passwordHash: hashPassword('OldPassword123!') };
  assert.equal(matchesExistingPassword('OldPassword123!', user), true);
  assert.equal(matchesExistingPassword('ACompletelyNewPassword456!', user), false);
});
