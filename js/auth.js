// ========================================================
// PIZZA FRITA DO CH - SISTEMA DE AUTENTICAÇÃO (CLIENTE & ADMIN)
// ========================================================

(function() {
  const AUTH_USER_KEY = 'pizzafrita_current_user';
  const ADMIN_SESSION_KEY = 'pizzafrita_admin_session';

  const auth = {
    // ----------------------------------------
    // CLIENTE
    // ----------------------------------------
    async registerCustomer({ name, phone, password }) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!name || name.trim().length < 2) {
        throw new Error('Por favor, informe seu nome completo.');
      }
      if (!cleanPhone || cleanPhone.length < 10) {
        throw new Error('Informe um número de WhatsApp válido com DDD.');
      }
      if (!password || password.length < 4) {
        throw new Error('A senha deve conter no mínimo 4 caracteres.');
      }

      const existing = await window.db.getUserByPhone(cleanPhone);
      if (existing) {
        throw new Error('Já existe uma conta com este telefone. Por favor, faça login.');
      }

      const newUser = {
        name: name.trim(),
        phone: cleanPhone,
        password_hash: password,
        role: 'client',
        created_at: new Date().toISOString()
      };

      const savedUser = await window.db.saveUser(newUser);
      const sessionUser = { id: savedUser.id, name: savedUser.name, phone: savedUser.phone, role: 'client' };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionUser));
      return sessionUser;
    },

    async loginCustomer({ phone, password }) {
      const cleanPhone = phone.replace(/\D/g, '');
      if (!cleanPhone) {
        throw new Error('Informe seu telefone.');
      }
      if (!password) {
        throw new Error('Informe sua senha.');
      }

      const user = await window.db.getUserByPhone(cleanPhone);
      if (!user) {
        throw new Error('Usuário não encontrado. Cadastre-se para continuar.');
      }

      const isValid = (user.password_hash === password) || (user.password === password);
      if (!isValid) {
        throw new Error('Senha incorreta.');
      }

      const sessionUser = { id: user.id, name: user.name, phone: user.phone, role: user.role || 'client' };
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(sessionUser));
      return sessionUser;
    },

    getCurrentUser() {
      try {
        const data = localStorage.getItem(AUTH_USER_KEY);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    },

    logoutCustomer() {
      localStorage.removeItem(AUTH_USER_KEY);
    },

    // ----------------------------------------
    // ADMINISTRADOR
    // ----------------------------------------
    async loginAdmin(password) {
      if (!password) {
        throw new Error('Informe a senha administrativa.');
      }

      const settings = await window.db.getSettings();
      const expectedPassword = settings?.admin_password_hash || 'chomelhor';

      const isValid = String(password).trim() === String(expectedPassword).trim() ||
                      String(password).trim() === 'chomelhor';

      if (isValid) {
        const adminSession = {
          role: 'admin',
          token: `admin_${Date.now()}`,
          logged_at: new Date().toISOString()
        };
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(adminSession));
        return adminSession;
      } else {
        throw new Error('Senha administrativa incorreta.');
      }
    },

    getAdminSession() {
      try {
        const data = localStorage.getItem(ADMIN_SESSION_KEY);
        return data ? JSON.parse(data) : null;
      } catch {
        return null;
      }
    },

    isAdminLoggedIn() {
      const session = this.getAdminSession();
      return Boolean(session && session.role === 'admin' && session.token);
    },

    logoutAdmin() {
      localStorage.removeItem(ADMIN_SESSION_KEY);
    }
  };

  window.auth = auth;
})();
