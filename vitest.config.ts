import { defineConfig } from 'vitest/config';

// Só os módulos puros. Nada aqui carrega React Native: o que precisa do dispositivo testa-se no
// dispositivo, e o que decide (a fila, os serializadores, os slugs) testa-se aqui, sem simular nada.
export default defineConfig({
  test: {
    include: ['domain/**/*.test.ts', 'services/**/*.test.ts'],
  },
});
