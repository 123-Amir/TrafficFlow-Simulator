import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrafficCanvas } from './TrafficCanvas';

describe('TrafficCanvas', () => {
  it('renders an accessible visualization surface', () => {
    const { getByLabelText } = render(<TrafficCanvas />);
    expect(getByLabelText('Traffic network visualization')).toBeTruthy();
  });
});
