import { userDisplayName } from './user-display-name';

describe('userDisplayName', () => {
  it('firstName and lastName both present → "First Last"', () => {
    expect(userDisplayName({ firstName: 'John', lastName: 'Smith' })).toBe('John Smith');
  });

  it('only firstName present → "First"', () => {
    expect(userDisplayName({ firstName: 'John', lastName: null })).toBe('John');
  });

  it('only lastName present → "Last"', () => {
    expect(userDisplayName({ firstName: null, lastName: 'Smith' })).toBe('Smith');
  });

  it('both undefined → falls back to email', () => {
    expect(userDisplayName({ firstName: undefined, lastName: undefined, email: 'john@example.com' })).toBe('john@example.com');
  });

  it('both empty strings → falls back to email', () => {
    expect(userDisplayName({ firstName: '', lastName: '', email: 'john@example.com' })).toBe('john@example.com');
  });

  it('whitespace-only firstName and lastName → falls back to email', () => {
    expect(userDisplayName({ firstName: '   ', lastName: '  ', email: 'john@example.com' })).toBe('john@example.com');
  });

  it('no name and no email → "ProjTrack user"', () => {
    expect(userDisplayName({ firstName: null, lastName: null, email: null })).toBe('ProjTrack user');
  });

  it('all fields undefined → "ProjTrack user"', () => {
    expect(userDisplayName({})).toBe('ProjTrack user');
  });

  it('trims leading and trailing whitespace from composed name', () => {
    const result = userDisplayName({ firstName: '  Alice  ', lastName: '  Wonder  ' });
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
    expect(result).toContain('Alice');
    expect(result).toContain('Wonder');
  });

  it('never returns "null null"', () => {
    const result = userDisplayName({ firstName: 'null', lastName: 'null' });
    expect(result).toBe('null null');
  });

  it('null firstName and null lastName with email → email fallback', () => {
    expect(userDisplayName({ firstName: null, lastName: null, email: 'user@projtrack.codes' })).toBe('user@projtrack.codes');
  });

  it('firstName only with email available → uses firstName not email', () => {
    expect(userDisplayName({ firstName: 'Alice', lastName: null, email: 'alice@example.com' })).toBe('Alice');
  });

  it('empty email also falls back to "ProjTrack user"', () => {
    expect(userDisplayName({ firstName: '', lastName: '', email: '' })).toBe('ProjTrack user');
  });

  it('email with whitespace is trimmed correctly', () => {
    expect(userDisplayName({ firstName: '', lastName: '', email: '  user@example.com  ' })).toBe('user@example.com');
  });
});

describe('userDisplayName — regression: values that caused dashboard bugs', () => {
  it('does not return "undefined undefined" when names are undefined', () => {
    const result = userDisplayName({ firstName: undefined, lastName: undefined });
    expect(result).not.toBe('undefined undefined');
  });

  it('does not return "John null" when lastName is null', () => {
    const result = userDisplayName({ firstName: 'John', lastName: null });
    expect(result).not.toBe('John null');
    expect(result).toBe('John');
  });

  it('does not return "null Smith" when firstName is null', () => {
    const result = userDisplayName({ firstName: null, lastName: 'Smith' });
    expect(result).not.toBe('null Smith');
    expect(result).toBe('Smith');
  });

  it('does not return extra leading/trailing space when one name is missing', () => {
    const result = userDisplayName({ firstName: 'Alice', lastName: null });
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });

  it('admin-created student keeps expected firstName and lastName', () => {
    expect(userDisplayName({ firstName: 'Maria', lastName: 'Santos' })).toBe('Maria Santos');
  });

  it('user with only email (no firstName or lastName set) uses email', () => {
    expect(userDisplayName({ firstName: null, lastName: null, email: 'student@projtrack.codes' })).toBe('student@projtrack.codes');
  });
});
