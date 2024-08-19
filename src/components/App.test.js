import { render, screen } from '@testing-library/react';
import App from './App';

test('renders learn react link', () => {
  render(<App />);
  const linkElement = screen.getByText(/Clique ou arraste ficheiros para esta área para começar/i);
  expect(linkElement).toBeInTheDocument();
});
