let sequence = 0;

export function fixtureUuid(): string {
  sequence++;

  return '00000000-0000-4000-8000-' + sequence.toString(16).padStart(12, '0');
}
