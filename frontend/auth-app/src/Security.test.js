import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RouteProtection from './RouteProtection';
import Bar from './Components/Bar';
import { ROLES } from './constants/roles';
import '@testing-library/jest-dom';

describe('Security Access Control logic', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('RouteProtection Component', () => {
    test('redirects to login when no token is present', () => {
      render(
        <MemoryRouter initialEntries={['/Members']}>
          <RouteProtection>
            <div data-testid="protected">Protected Content</div>
          </RouteProtection>
        </MemoryRouter>
      );
      // In a real redirect, we'd check if we are on the login page.
      // Here we check that the component DOES NOT render children.
      expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    });

    test('redirects to excels when role is sufficient but route restricted to admin', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('role', ROLES.MEMBRE);

      render(
        <MemoryRouter initialEntries={['/Members']}>
          <RouteProtection allowedRoles={[ROLES.ADMIN]}>
            <div data-testid="protected">Protected Content</div>
          </RouteProtection>
        </MemoryRouter>
      );
      expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
    });

    test('allows access for admin role', () => {
      localStorage.setItem('token', 'fake-token');
      localStorage.setItem('role', ROLES.ADMIN);

      render(
        <MemoryRouter initialEntries={['/Members']}>
          <RouteProtection allowedRoles={[ROLES.ADMIN]}>
            <div data-testid="protected">Protected Content</div>
          </RouteProtection>
        </MemoryRouter>
      );
      expect(screen.getByTestId('protected')).toBeInTheDocument();
    });
  });

  describe('Bar (Sidebar) Filtering', () => {
    test('hides Membres link for regular users', () => {
      localStorage.setItem('role', ROLES.MEMBRE);
      
      render(
        <MemoryRouter>
          <Bar />
        </MemoryRouter>
      );
      
      expect(screen.queryByText('Membres')).not.toBeInTheDocument();
      expect(screen.getByText('Rapports')).toBeInTheDocument();
    });

    test('shows Membres link for admin users', () => {
      localStorage.setItem('role', ROLES.ADMIN);
      
      render(
        <MemoryRouter>
          <Bar />
        </MemoryRouter>
      );
      
      expect(screen.getByText('Membres')).toBeInTheDocument();
    });
  });
});
